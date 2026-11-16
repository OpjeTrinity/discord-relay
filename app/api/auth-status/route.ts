import { NextRequest, NextResponse } from 'next/server';
import { redis, REDIS_KEY } from '@/lib/redis';
import { isPinValid } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (!isPinValid(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = await redis.get(REDIS_KEY);

  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  if (!raw) {
    return NextResponse.json({ active: false }, { headers });
  }

  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return NextResponse.json({ active: true, ...data }, { headers });
}
