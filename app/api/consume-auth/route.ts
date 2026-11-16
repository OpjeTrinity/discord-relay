import { NextRequest, NextResponse } from 'next/server';
import { redis, REDIS_KEY } from '@/lib/redis';
import { isPinValid } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!isPinValid(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await redis.del(REDIS_KEY);
  return NextResponse.json({ success: true });
}
