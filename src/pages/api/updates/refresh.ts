import type { APIRoute } from "astro";

import { isAuthorizedCronRequest } from "@/server/cron-auth";
import { refreshProjectUpdates } from "@/server/project-updates";

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), import.meta.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await refreshProjectUpdates();
  return Response.json({ result }, { status: result === "unconfigured" || result === "busy" ? 503 : 200 });
};
