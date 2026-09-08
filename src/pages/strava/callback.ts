import type { APIRoute } from "astro";
import { setStravaToken } from "@/server/strava";

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = cookies.get("strava_oauth_state")?.value;
  cookies.delete("strava_oauth_state", { path: "/strava/callback" });
  if (!code || !state || state !== expectedState) return new Response("Invalid OAuth state", { status: 400 });

  const body = new URLSearchParams({
    client_id: import.meta.env.STRAVA_CLIENT_ID,
    client_secret: import.meta.env.STRAVA_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
  });
  const response = await fetch("https://www.strava.com/api/v3/oauth/token", { method: "POST", body });
  if (!response.ok) return new Response("Strava authorization failed", { status: 502 });
  const token = await response.json();
  await setStravaToken({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: token.expires_at,
  });
  return redirect("/?strava=connected");
};
