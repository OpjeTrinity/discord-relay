import { NextRequest, NextResponse } from 'next/server';
import { redis, REDIS_KEY } from '@/lib/redis';
import { isPinValid } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!isPinValid(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = await redis.get(REDIS_KEY);
  if (!raw) {
    return NextResponse.json({ active: false });
  }

  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return NextResponse.json({ active: true, ...data });
}
