import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const scaledValue = (value: number) => Math.max((value / 100) * 20, 5);

export const generateRandomValues = (numBars: number) => {
  return Array.from({ length: numBars }, () => scaledValue(Math.random() * 100));
};

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

let tokenData: TokenData | null = null;
let tokenExpirationTime: number | null = null;

const BASE_URL = import.meta.env.DEV 
  ? 'http://localhost:4321' 
  : 'https://www.glamboyosa.xyz';
  export async function getValidToken() {
  console.log("token data is", tokenData)
  const now = Date.now();
  
  if (tokenData && tokenExpirationTime && now < tokenExpirationTime - 300000) {
    return tokenData.access_token;
  }

  const response = await fetch(`${BASE_URL}/api/token`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: tokenData?.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const newTokenData = await response.json();
  tokenData = newTokenData;
  tokenExpirationTime = now + (newTokenData.expires_in * 1000);
  
  return newTokenData.access_token;
}

