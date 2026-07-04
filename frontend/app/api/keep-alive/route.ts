import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://luminous-real-estate.onrender.com';
  
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
  } catch (error: any) {
    console.error('[Vercel Cron] Ping failed:', error.message);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
