import { Redis } from '@upstash/redis';
import type { APIRoute } from 'astro';

const CLIENT_ID = import.meta.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.SPOTIFY_CLIENT_SECRET;
const redis = new Redis({
  url: import.meta.env.UPSTASH_REDIS_REST_URL,
  token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
})

export const POST: APIRoute = async ({ request, cookies }) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': 'https://glamboyosa.xyz',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  }

  try {
    const body = await request.json();
    const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

    // Handle different grant types
    const params = new URLSearchParams();
    
    if (body.grant_type === 'authorization_code') {
      params.append('grant_type', 'authorization_code');
      params.append('code', body.code);
      params.append('redirect_uri', body.redirect_uri);
      params.append('client_id', CLIENT_ID);
      params.append('code_verifier', body.code_verifier);
    } else if (body.grant_type === 'refresh_token') {
      const refreshToken = await redis.get<string>('spotify_refresh_token');
      console.log("refresh token is", refreshToken)
      if (!refreshToken) {
        throw new Error('Refresh token not found');
      }
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', refreshToken);
    } else {
      params.append('grant_type', 'client_credentials');
    }
    
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
    
    // Set access token in cookie
    cookies.set('spotify_access_token', data.access_token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: data.expires_in
    });
    await redis.set('spotify_access_token', data.access_token);
    await redis.set('spotify_refresh_token', data.refresh_token);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://glamboyosa.xyz',
        'Access-Control-Allow-Credentials': 'true',
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
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://glamboyosa.xyz',
          'Access-Control-Allow-Credentials': 'true',
        }
      }
    );
  }
}; 