function generateRandomString(length: number) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

async function sha256(plain: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64encode(input: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export async function generateCodeChallenge(verifier: string) {
  const hashed = await sha256(verifier);
  return base64encode(hashed);
}

export async function initiateSpotifyAuth() {
  // Fetch client ID from server
  const response = await fetch('/api/client-id');
  const { clientId } = await response.json();
  
  const redirectUri = `${window.location.origin}/callback`;
  const codeVerifier = generateRandomString(128);

  const scope = 'user-read-currently-playing user-read-recently-played';
  const authUrl = new URL("https://accounts.spotify.com/authorize");

  // Store code verifier for later use
  window.localStorage.setItem('code_verifier', codeVerifier);

  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const params = {
    response_type: 'code',
    client_id: clientId,
    scope,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
  };

  authUrl.search = new URLSearchParams(params).toString();
  window.location.href = authUrl.toString();
} 