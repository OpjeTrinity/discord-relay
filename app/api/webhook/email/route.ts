import { NextRequest, NextResponse } from 'next/server';
import { redis, REDIS_KEY, TTL_SECONDS } from '@/lib/redis';

// Discord verification URL patterns
const URL_PATTERNS = [
  /https:\/\/click\.discord\.com\/ls\/click\?[^\s"'<>]+/i,
  /https:\/\/click\.discord\.com\/[^\s"'<>]+/i,
  /https:\/\/email\.discord\.com\/[^\s"'<>]+/i,
  /https:\/\/discord\.com\/ra\/[^\s"'<>]+/i,
  /https:\/\/discord\.com\/authorize-ip[^\s"'<>]+/i,
  /https:\/\/discord\.com\/verify[^\s"'<>]+/i,
  /https:\/\/discordapp\.com\/authorize-ip[^\s"'<>]+/i,
  /https:\/\/discordapp\.com\/verify[^\s"'<>]+/i,
  /https:\/\/[a-z0-9.-]*discord(?:app)?\.com\/[^\s"'<>]+/i,
];

const IP_PATTERN = /(?:Direcci[oó]n\s+IP|IP(?:\s*Address)?|IP)[:\s]+([0-9]{1,3}(?:\.[0-9]{1,3}){3}(?::[0-9]+)?)/i;
const LOCATION_PATTERN = /(?:Location|Near|Ubicaci[oó]n|Lieu|Ort)[:\s]+([^\n\r<]+?)(?:\s*<|\s*\n|\s*\r|$)/i;

function extractVerificationUrl(cleanBody: string): string | null {
  // 1. Target the primary Blue/Blurple (#5865F2) action button in Discord's HTML template
  const blurpleButtonMatch =
    cleanBody.match(
      /<(?:td|a|table)\b[^>]*(?:bgcolor=["']?#5865F2|background(?:-color)?:\s*#5865F2)[^>]*>[\s\S]{0,400}?<a\b[^>]*\bhref=["'](https:\/\/[^"']+)["']/i
    ) ||
    cleanBody.match(
      /<a\b[^>]*\bhref=["'](https:\/\/[^"']+)["'][^>]*(?:bgcolor=["']?#5865F2|background(?:-color)?:\s*#5865F2)/i
    );
  if (blurpleButtonMatch) {
    return blurpleButtonMatch[1].replace(/&amp;/g, '&').trim();
  }

  // 2. Target anchor tag with multi-language verification text (Verificar, Verify, Vérifier, Autorizar, etc.)
  const ctaMatch = cleanBody.match(
    /<a\b[^>]*\bhref=["'](https:\/\/[^"']+)["'][^>]*>(?:(?!<\/a>)[\s\S])*(?:Verif|Autoriz|Authoriz|inicio de sesi|iniciar sesi|confirm)(?:(?!<\/a>)[\s\S])*<\/a>/i
  );
  if (ctaMatch) {
    return ctaMatch[1].replace(/&amp;/g, '&').trim();
  }

  // 3. Direct authorize-ip or token URL
  const directMatch =
    cleanBody.match(/https:\/\/(?:[a-z0-9.-]+\.)?discord(?:app)?\.com\/(?:authorize-ip|verify|ra)[^\s"'<>]*/i) ||
    cleanBody.match(/https:\/\/[^\s"'<>]*token=[a-zA-Z0-9._-]+/i);
  if (directMatch) {
    return directMatch[0].replace(/&amp;/g, '&').trim();
  }

  // 4. Link following text like "Verificar inicio de sesión", "Verify Login", "autorizar"
  const followingMatch = cleanBody.match(
    /(?:Verificar inicio de sesión|Verify Login|Authorize Login|Authorize IP|autorizar el inicio de sesión)[\s\S]{0,350}?(https:\/\/(?:click\.discord\.com|discord\.com|email\.discord\.com)[^\s"'<>]+)/i
  );
  if (followingMatch) {
    return followingMatch[1].replace(/&amp;/g, '&').trim();
  }

  // 5. If multiple SendGrid click links exist:
  // Link 1 is header logo, Link 2 is reset password, Link 3 is the blue button!
  const allClickLinks = Array.from(
    cleanBody.matchAll(/https:\/\/click\.discord\.com\/ls\/click\?[^\s"'<>]+/gi)
  ).map((m) => m[0].replace(/&amp;/g, '&').trim());

  if (allClickLinks.length >= 3) {
    // Return Link 3 (the blue CTA button)
    return allClickLinks[2];
  } else if (allClickLinks.length === 2) {
    return allClickLinks[1];
  } else if (allClickLinks.length === 1) {
    return allClickLinks[0];
  }

  // 6. Generic Discord link fallback (skipping bare root domain)
  const fallbackMatch = cleanBody.match(/https:\/\/(?:click\.|email\.)?discord(?:app)?\.com\/[^\s"'<>]+/i);
  if (fallbackMatch && !fallbackMatch[0].endsWith('discord.com/')) {
    return fallbackMatch[0].replace(/&amp;/g, '&').trim();
  }

  return null;
}

function extractFromBody(body: string): { url: string | null; ip: string | null; location: string | null } {
  // Unescape backslashes and HTML entities first
  const cleanBody = body.replace(/\\/g, '').replace(/&amp;/g, '&');

  const url = extractVerificationUrl(cleanBody);

  const ipMatch = cleanBody.match(IP_PATTERN);
  const ip = ipMatch ? ipMatch[1].trim() : null;

  const locationMatch = cleanBody.match(LOCATION_PATTERN);
  const location = locationMatch ? locationMatch[1].trim() : null;

  return { url, ip, location };
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function POST(req: NextRequest) {
  // Validate webhook secret
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  const contentType = req.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      body = await req.json();
    } else if (
      contentType.includes('multipart/form-data') ||
      contentType.includes('application/x-www-form-urlencoded')
    ) {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string') {
          body[key] = value;
        } else if (value && typeof (value as Blob).text === 'function') {
          try {
            body[key] = await (value as Blob).text();
          } catch {
            body[key] = value.name;
          }
        }
      }
    } else {
      // Fallback try JSON
      body = await req.json();
    }
  } catch (err) {
    console.error('[webhook] Error parsing body:', err);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Full serialized text for universal pattern matching
  const fullPayloadText = JSON.stringify(body);

  // Support CloudMailin, Mailgun, and custom payload shapes
  const headers = (body.headers as Record<string, unknown>) ?? {};
  const envelope = (body.envelope as Record<string, unknown>) ?? {};

  const subject = (
    (body.subject as string) ??
    (body.Subject as string) ??
    (headers.subject as string) ??
    (headers.Subject as string) ??
    ''
  ).trim();

  const from = (
    (body.from as string) ??
    (body.sender as string) ??
    (body.From as string) ??
    (headers.from as string) ??
    (headers.From as string) ??
    (envelope.from as string) ??
    ''
  ).trim();

  const htmlBody =
    (body.html as string) ??
    (body['body-html'] as string) ??
    (body.Html as string) ??
    '';
  const plainBody =
    (body.plain as string) ??
    (body['body-plain'] as string) ??
    (body.Plain as string) ??
    (body.stripped_text as string) ??
    '';

  const combinedText = plainBody + ' ' + htmlBody + ' ' + fullPayloadText;

  // Handle Gmail forwarding verification email if received
  const isGoogleForwarding =
    from.toLowerCase().includes('google.com') ||
    subject.toLowerCase().includes('forwarding confirmation') ||
    combinedText.toLowerCase().includes('forwarding confirmation') ||
    combinedText.toLowerCase().includes('confirmation code');

  if (isGoogleForwarding) {
    const codeMatch =
      combinedText.match(/confirmation code[^0-9]*([0-9]{8,10})/i) ||
      combinedText.match(/confirmation code(?:\s+is)?[:\s\\n\r]+([0-9]+)/i) ||
      combinedText.match(/([0-9]{8,10})/);
    const code = codeMatch ? codeMatch[1] : null;

    const verifyUrlMatch = combinedText.match(/https:\/\/mail-settings\.google\.com\/mail\/vf-[^\s"'<>\\]+/);
    const verifyUrl = verifyUrlMatch ? verifyUrlMatch[0].replace(/\\/g, '') : null;

    console.log('[webhook] Gmail forwarding received! Code:', code, 'URL:', verifyUrl);

    const payload = {
      subject: subject || 'Gmail Forwarding Confirmation',
      from: from || 'forwarding-noreply@google.com',
      html: htmlBody,
      plain: plainBody,
      code,
      url: verifyUrl ?? 'https://mail.google.com/',
      receivedAt: new Date().toISOString(),
    };

    try {
      await redis.set(REDIS_KEY, JSON.stringify(payload), { ex: TTL_SECONDS });
      console.log('[webhook] Saved Gmail confirmation to Redis');
    } catch (err) {
      console.error('[webhook] Redis set error:', err);
    }

    return NextResponse.json({ success: true, message: 'Gmail verification handled', code, verifyUrl });
  }

  // Validate Discord email (broad detection so no notification is dropped)
  const isDiscordEmail =
    from.toLowerCase().includes('discord') ||
    subject.toLowerCase().includes('discord') ||
    subject.toLowerCase().includes('login location') ||
    subject.toLowerCase().includes('authorize') ||
    combinedText.toLowerCase().includes('discord.com');

  if (!isDiscordEmail) {
    console.log('[webhook] Ignored non-Discord email from:', from, 'Subject:', subject);
    return NextResponse.json({ ignored: true, reason: 'Not recognized as a Discord email' }, { status: 200 });
  }

  // Store the ENTIRE email content so it displays exactly as sent
  const payload = {
    subject: subject || 'Discord Notification',
    from: from || 'noreply@discord.com',
    html: htmlBody,
    plain: plainBody,
    receivedAt: new Date().toISOString(),
  };

  try {
    await redis.set(REDIS_KEY, JSON.stringify(payload), { ex: TTL_SECONDS });
    console.log('[webhook] Stored full email payload to Redis, subject:', payload.subject);
  } catch (err) {
    console.error('[webhook] Redis set error:', err);
  }

  return NextResponse.json({ success: true });
}
