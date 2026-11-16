import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const country = (req.headers.get('x-vercel-ip-country') || '').toUpperCase();
  const city = req.headers.get('x-vercel-ip-city') || '';
  const region = req.headers.get('x-vercel-ip-country-region') || '';

  return NextResponse.json({
    country,
    city,
    region,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
