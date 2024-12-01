import type { APIRoute } from 'astro';

const CLIENT_ID = import.meta.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.SPOTIFY_CLIENT_SECRET;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

    // Determine if this is a refresh token request or initial token request
    const params = new URLSearchParams({
      ...(body.refresh_token 
        ? {
            grant_type: 'refresh_token',
            refresh_token: body.refresh_token,
          }
        : {
            grant_type: 'client_credentials',
          }),
    });

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error with token operation:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to perform token operation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}; 