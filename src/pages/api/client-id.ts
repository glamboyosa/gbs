import type { APIRoute } from 'astro';

const ALLOWED_ORIGINS = ['https://www.glamboyosa.xyz'];

export const GET: APIRoute = async ({ request }) => {
  const origin = request.headers.get('Origin');
  const allowedOrigin: string = ALLOWED_ORIGINS.includes(origin!) ? origin! : ALLOWED_ORIGINS[0];

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  }

  return new Response(
    JSON.stringify({ 
      clientId: import.meta.env.SPOTIFY_CLIENT_ID 
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Credentials': 'true',
      }
    }
  );
}; 