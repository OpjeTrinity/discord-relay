import { NextRequest } from 'next/server';

export function isPinValid(req: NextRequest): boolean {
  const pin = req.headers.get('x-access-pin');
  return pin === process.env.APP_ACCESS_PIN;
}
