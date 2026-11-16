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

const IP_PATTERN = /(?:IP(?:\s*Address)?|IP)[:\s]+([0-9]{1,3}(?:\.[0-9]{1,3}){3}(?::[0-9]+)?)/i;
const LOCATION_PATTERN = /(?:Location|Near)[:\s]+([^\n\r<]+?)(?:\s*<|\s*\n|\s*\r|$)/i;

function extractFromBody(body: string): { url: string | null; ip: string | null; location: string | null } {
  let url: string | null = null;

  // Unescape backslashes and HTML entities first
  const cleanBody = body.replace(/\\/g, '').replace(/&amp;/g, '&');

  for (const pattern of URL_PATTERNS) {
    const match = cleanBody.match(pattern);
    if (match) {
      url = match[0].replace(/&amp;/g, '&').trim();
      break;
    }
  }

  // Also check href="..."
  if (!url) {
    const hrefMatch = cleanBody.match(/href=["'](https:\/\/[^"']*discord[^"']*)["']/i);
    if (hrefMatch) {
      url = hrefMatch[1].replace(/&amp;/g, '&').trim();
    }
  }

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
      url: verifyUrl ?? 'https://mail.google.com/',
      ip: code ? `Gmail Code: ${code}` : 'Gmail Forwarding Received',
      location: code ? 'Enter this confirmation code in Gmail settings' : 'Verification email processed',
      receivedAt: new Date().toISOString(),
    };

    try {
      await redis.set(REDIS_KEY, JSON.stringify(payload), { ex: TTL_SECONDS });
      console.log('[webhook] Saved Gmail confirmation to Redis:', payload);
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

  // Try HTML first, fall back to plain text, and search whole payload
  const searchText = decodeHtmlEntities(htmlBody || plainBody || combinedText);
  const extraction = extractFromBody(searchText);

  let finalUrl = extraction.url;
  if (!finalUrl) {
    // Search combined payload text for any Discord link
    for (const pattern of URL_PATTERNS) {
      const match = combinedText.match(pattern);
      if (match) {
        finalUrl = match[0].replace(/\\/g, '').replace(/&amp;/g, '&').trim();
        break;
      }
    }
  }

  const payload = {
    url: finalUrl ?? 'https://discord.com/login',
    ip: extraction.ip ?? 'Discord Security Alert',
    location: extraction.location ?? (subject || 'New location detected'),
    receivedAt: new Date().toISOString(),
  };

  try {
    await redis.set(REDIS_KEY, JSON.stringify(payload), { ex: TTL_SECONDS });
    console.log('[webhook] Stored Discord auth payload:', JSON.stringify({ ...payload, url: finalUrl ? '[FOUND]' : '[DEFAULT]' }));
  } catch (err) {
    console.error('[webhook] Redis set error:', err);
  }

  return NextResponse.json({ success: true, urlFound: !!finalUrl });
}
