import type { APIRoute } from "astro";

import { wishlistItems } from "@/data/wishlist";
import { claimItem, getClaims, isRateLimited, unclaimItem } from "@/server/wishlist-claims";

const itemIds = new Set(wishlistItems.map((item) => item.id));

const readBody = async (request: Request): Promise<Record<string, unknown>> => {
  const body: unknown = await request.json().catch(() => null);
  return body && typeof body === "object" ? body as Record<string, unknown> : {};
};

const limited = () => Response.json({ status: "limited" }, { status: 429 });

export const GET: APIRoute = async () => Response.json({ claims: await getClaims() }, { headers: { "Cache-Control": "no-store" } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (await isRateLimited(clientAddress)) return limited();
  const { itemId, name } = await readBody(request);
  const result = await claimItem({ itemId, name, itemIds });
  const status = { claimed: 201, taken: 409, invalid: 400, unconfigured: 503 }[result.status];
  return Response.json(result, { status });
};

export const DELETE: APIRoute = async ({ request, clientAddress }) => {
  if (await isRateLimited(clientAddress)) return limited();
  const { itemId, token } = await readBody(request);
  const result = await unclaimItem({ itemId, token });
  const status = { unclaimed: 200, forbidden: 403, unconfigured: 503 }[result];
  return Response.json({ status: result }, { status });
};
