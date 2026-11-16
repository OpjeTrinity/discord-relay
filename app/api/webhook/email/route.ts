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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Support both CloudMailin and Mailgun payload shapes
  const subject = (body.subject as string) ?? '';
  const from = (body.from as string) ?? (body.sender as string) ?? '';
  const htmlBody = (body.html as string) ?? (body['body-html'] as string) ?? '';
  const plainBody = (body.plain as string) ?? (body['body-plain'] as string) ?? '';

  // Validate origin
  const isDiscordEmail =
    from.toLowerCase().includes('discord.com') || from.toLowerCase().includes('noreply@discord');
  const isVerificationEmail =
    subject.toLowerCase().includes('verify') && subject.toLowerCase().includes('discord');

  if (!isDiscordEmail && !isVerificationEmail) {
    return NextResponse.json({ error: 'Not a Discord verification email' }, { status: 422 });
  }

  // Try HTML first, fall back to plain text
  const searchText = decodeHtmlEntities(htmlBody || plainBody);
  const { url, ip, location } = extractFromBody(searchText);

  const finalExtraction = url ? { url, ip, location } : extractFromBody(plainBody);

  if (!finalExtraction.url) {
    console.error('[webhook] No verification URL found in email body');
    return NextResponse.json({ error: 'No verification URL found' }, { status: 422 });
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
