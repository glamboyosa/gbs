'use client';
import { initiateSpotifyAuth } from '@/lib/pkce';
import { useState } from 'react';

export function SpotifyLogin() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      await initiateSpotifyAuth();
    } catch (error) {
      console.error('Failed to initiate Spotify auth:', error);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogin}
      disabled={isLoading}
      className="rounded-full bg-[#1DB954] px-4 py-2 text-white hover:bg-[#1ed760] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? 'Connecting...' : 'Connect Spotify'}
    </button>
  );
} 