import assert from "node:assert/strict";
import test from "node:test";

import { isAuthorizedCronRequest } from "./cron-auth.ts";

test("accepts the exact Vercel bearer token", () => {
  assert.equal(isAuthorizedCronRequest("Bearer long-test-secret", "long-test-secret"), true);
});

test("rejects missing or incorrect cron credentials", () => {
  assert.equal(isAuthorizedCronRequest(null, "long-test-secret"), false);
  assert.equal(isAuthorizedCronRequest("Bearer wrong-secret", "long-test-secret"), false);
  assert.equal(isAuthorizedCronRequest("Bearer undefined", undefined), false);
});
