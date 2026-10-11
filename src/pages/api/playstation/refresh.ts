import type { APIRoute } from "astro";

import { isAuthorizedCronRequest } from "@/server/cron-auth";
import { refreshPlayStationSummary } from "@/server/playstation";

export const GET: APIRoute = async ({ request }) => {
  const authorized = isAuthorizedCronRequest(
    request.headers.get("authorization"),
    import.meta.env.CRON_SECRET,
  );
  if (!authorized) return new Response("Unauthorized", { status: 401 });

  await refreshPlayStationSummary();
  return Response.json({ refreshed: true });
};
