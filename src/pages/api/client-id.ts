import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': 'https://glamboyosa.xyz',
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
        'Access-Control-Allow-Origin': 'https://glamboyosa.xyz',
        'Access-Control-Allow-Credentials': 'true',
      }
    }
  );
}; 