import { test } from "node:test";
import assert from "node:assert/strict";
import { embedUrl } from "../../src/lib/embed";
import { portfolioSeeds } from "../../content/achievements";

test("seeded releases produce official Spotify embed URLs", () => {
  for (const p of portfolioSeeds) {
    assert.ok(p.embedProvider && p.embedId);
    const url = embedUrl({ provider: p.embedProvider, id: p.embedId });
    assert.ok(url?.startsWith("https://open.spotify.com/embed/album/"), url ?? "null");
  }
});

test("anything that isn't a clean id is refused", () => {
  assert.equal(embedUrl({ provider: "SPOTIFY", id: "album/577TEkqeYU0F3iqerqpq45?x=<script>" }), null);
  assert.equal(embedUrl({ provider: "SPOTIFY", id: "https://evil.example/album" }), null);
  assert.equal(embedUrl({ provider: "YOUTUBE", id: "dQw4w9WgXcQ" }), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0");
  assert.equal(embedUrl({ provider: "YOUTUBE", id: "dQw4w9WgXcQ\"><img" }), null);
});
