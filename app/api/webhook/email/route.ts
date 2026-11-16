import { NextRequest, NextResponse } from 'next/server';
import { redis, REDIS_KEY, TTL_SECONDS } from '@/lib/redis';

// Discord verification URL patterns
const URL_PATTERNS = [
  /https:\/\/click\.discord\.com\/ls\/click\?upn=[^\s"'<>]+/,
  /https:\/\/discord\.com\/authorize-ip[^\s"'<>]+/,
  /https:\/\/discord\.com\/verify[^\s"'<>]+/,
];

const IP_PATTERN = /IP Address[:\s]+([0-9]{1,3}(?:\.[0-9]{1,3}){3}(?::[0-9]+)?)/i;
const LOCATION_PATTERN = /Location[:\s]+([^\n\r<]+?)(?:\s*<|\s*\n|\s*\r)/i;

function extractFromBody(body: string): { url: string | null; ip: string | null; location: string | null } {
  let url: string | null = null;
  for (const pattern of URL_PATTERNS) {
    const match = body.match(pattern);
    if (match) {
      url = match[0].replace(/&amp;/g, '&').trim();
      break;
    }
  }

  const ipMatch = body.match(IP_PATTERN);
  const ip = ipMatch ? ipMatch[1].trim() : null;

  const locationMatch = body.match(LOCATION_PATTERN);
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
      formData.forEach((value, key) => {
        body[key] = typeof value === 'string' ? value : value.name;
      });
    } else {
      // Fallback try JSON
      body = await req.json();
    }
  } catch (err) {
    console.error('[webhook] Error parsing body:', err);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

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

  // Handle Gmail forwarding verification email if received
  if (
    from.toLowerCase().includes('google.com') ||
    subject.toLowerCase().includes('forwarding confirmation') ||
    plainBody.includes('confirmation code')
  ) {
    const codeMatch =
      plainBody.match(/confirmation code is:?\s*([0-9]+)/i) ||
      htmlBody.match(/confirmation code is:?\s*([0-9]+)/i);
    const code = codeMatch ? codeMatch[1] : null;

    console.log('[webhook] Gmail forwarding confirmation received! Code:', code || 'Check body');

    if (code) {
      const payload = {
        url: `https://mail.google.com/`,
        ip: `Gmail Code: ${code}`,
        location: 'Enter this confirmation code in Gmail settings',
        receivedAt: new Date().toISOString(),
      };
      await redis.set(REDIS_KEY, JSON.stringify(payload), { ex: TTL_SECONDS });
    }

    return NextResponse.json({ success: true, message: 'Gmail verification handled' });
  }

  // Validate origin
  const isDiscordEmail =
    from.toLowerCase().includes('discord.com') || from.toLowerCase().includes('noreply@discord');
  const isVerificationEmail =
    subject.toLowerCase().includes('verify') && subject.toLowerCase().includes('discord');

  if (!isDiscordEmail && !isVerificationEmail) {
    console.log('[webhook] Ignored non-Discord email from:', from, 'Subject:', subject);
    // Return 200 so Mailgun / CloudMailin does not treat it as a delivery failure / reject it
    return NextResponse.json({ ignored: true, reason: 'Not a Discord verification email' }, { status: 200 });
  }

  // Try HTML first, fall back to plain text
  const searchText = decodeHtmlEntities(htmlBody || plainBody);
  const { url, ip, location } = extractFromBody(searchText);

  const finalExtraction = url ? { url, ip, location } : extractFromBody(plainBody);

  if (!finalExtraction.url) {
    console.error('[webhook] No verification URL found in Discord email body');
    return NextResponse.json({ ignored: true, reason: 'No verification URL found' }, { status: 200 });
  }

  const payload = {
    url: finalExtraction.url,
    ip: finalExtraction.ip ?? 'Unknown',
    location: finalExtraction.location ?? 'Unknown',
    receivedAt: new Date().toISOString(),
  };

  await redis.set(REDIS_KEY, JSON.stringify(payload), { ex: TTL_SECONDS });

  console.log('[webhook] Stored Discord auth payload:', JSON.stringify({ ...payload, url: '[REDACTED]' }));

  return NextResponse.json({ success: true });
}
