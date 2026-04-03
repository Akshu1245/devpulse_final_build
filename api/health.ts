// Ultra-minimal Vercel serverless handler - no imports
export default function handler(req: Request) {
  return new Response(
    JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "devpulse-api",
      version: "1.0.0",
      vercel: true,
    }, null, 2),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
