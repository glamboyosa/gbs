import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const url = new URL(request.url);
  const setupToken = url.searchParams.get("token");
  if (!import.meta.env.STRAVA_SETUP_TOKEN || setupToken !== import.meta.env.STRAVA_SETUP_TOKEN) {
    return new Response("Not found", { status: 404 });
  }

  const state = crypto.randomUUID();
  cookies.set("strava_oauth_state", state, {
    path: "/strava/callback",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    maxAge: 600,
  });

  const authorizeUrl = new URL("https://www.strava.com/oauth/authorize");
  authorizeUrl.search = new URLSearchParams({
    client_id: import.meta.env.STRAVA_CLIENT_ID,
    redirect_uri: new URL("/strava/callback", request.url).toString(),
    response_type: "code",
    approval_prompt: "auto",
    scope: "read",
    state,
  }).toString();
  return redirect(authorizeUrl.toString());
};
