import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

for (const userAgent of [
  "ClaudeBot/1.0",
  "Mozilla/5.0; Claude-SearchBot/1.0",
  "Mozilla/5.0; GPTBot/1.2",
  "Mozilla/5.0 (compatible; OAI-SearchBot/1.0)",
  "Mozilla/5.0 (compatible; ChatGPT-User/1.0)",
  "Mozilla/5.0 (compatible; Baiduspider/2.0)",
  "Mozilla/5.0 (compatible; Bytespider)",
  "Mozilla/5.0 (compatible; Meta-ExternalAgent/1.1)",
  "Mozilla/5.0 (compatible; AhrefsBot/7.0)",
  "Mozilla/5.0 (compatible; SemrushBot/7~bl)",
  "Mozilla/5.0 (compatible; MJ12bot/v1.4.8)",
  "Mozilla/5.0 (compatible; DotBot/1.2)",
  "Mozilla/5.0 (compatible; PetalBot)",
  "Mozilla/5.0 (compatible; YandexBot/3.0)",
]) {
  test(`blocks abusive crawler ${userAgent}`, async () => {
    const request = new NextRequest("https://scenthub.se/fragrance/example", {
      headers: { "user-agent": userAgent },
    });

    const response = await proxy(request);

    assert.equal(response.status, 403);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  });
}
