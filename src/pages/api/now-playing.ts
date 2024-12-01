import type { APIRoute } from 'astro';
import type { SpotifyData, SpotifyPlaybackState } from '@/lib/types';

const REFRESH_TOKEN = import.meta.env.SPOTIFY_REFRESH_TOKEN;

export const GET: APIRoute = async () => {
  try {
    const tokenResponse = await fetch('http://localhost:4321/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: REFRESH_TOKEN
      })
    });
    
    if (!tokenResponse.ok) {
      throw new Error('Failed to get access token');
    }

    const { access_token } = await tokenResponse.json();

    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (response.status === 204 || response.status > 400) {
      return new Response(JSON.stringify({
        isPlaying: false,
        title: '',
        artist: '',
        albumImageUrl: '',
        progress_ms: 0
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const song = await response.json() as SpotifyPlaybackState;

    const data: SpotifyData & { progress_ms: number } = {
      isPlaying: song.is_playing,
      title: song.item?.name,
      artist: song.item?.artists[0]?.name,
      albumImageUrl: song.item?.album?.images[0]?.url,
      progress_ms: song.progress_ms
    };

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error fetching now playing:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch now playing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}; 