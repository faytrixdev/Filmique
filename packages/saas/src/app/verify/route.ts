import { NextResponse, type NextRequest } from 'next/server';
import { verifyByClick } from '@/app/actions/auth';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.redirect(new URL('/login', req.url));
  const res = await verifyByClick(token);
  if (res.ok) return NextResponse.redirect(new URL('/app', req.url));
  return NextResponse.redirect(new URL('/login?mode=pas%20de%20session', req.url));
}
