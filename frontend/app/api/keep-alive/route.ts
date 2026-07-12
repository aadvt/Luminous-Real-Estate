import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backendUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://luminous-real-estate-1-2.onrender.com').replace(/\/$/, '');
  
  try {
    console.log(`[Vercel Cron] Pinging backend at ${backendUrl}/health`);
    const res = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 0 } // Disable Next.js fetch caching
    });
    
    if (!res.ok) {
      return NextResponse.json({ 
        success: false, 
        message: `Backend returned status ${res.status}` 
      }, { status: res.status });
    }
    
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ 
      success: true, 
      backendStatus: data,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Vercel Cron] Ping failed:', message);
    return NextResponse.json({ 
      success: false, 
      error: message 
    }, { status: 500 });
  }
}
