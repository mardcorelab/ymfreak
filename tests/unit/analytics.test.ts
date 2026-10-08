import { test } from "node:test";
import assert from "node:assert/strict";
import { channelOf, cleanLabel, cleanUtm, dailyVisitor, deviceOf, isBot, normalizePath, referrerHost } from "../../src/server/analytics/classify";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("bots and empty user agents are ignored", () => {
  assert.equal(isBot(CHROME), false);
  assert.equal(isBot("Googlebot/2.1 (+http://www.google.com/bot.html)"), true);
  assert.equal(isBot("Mozilla/5.0 HeadlessChrome/141.0"), true);
  assert.equal(isBot(null), true);
});

test("device classes", () => {
  assert.equal(deviceOf(CHROME), "desktop");
  assert.equal(deviceOf(IPHONE), "mobile");
  assert.equal(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "tablet");
});

test("only public paths are counted, private ones are grouped", () => {
  assert.deepEqual(normalizePath("/es"), { path: "/", locale: "es" });
  assert.deepEqual(normalizePath("/en/services/"), { path: "/services", locale: "en" });
  assert.deepEqual(normalizePath("/es/checkout/cabc123?payment=paid"), { path: "/checkout", locale: "es" });
  assert.deepEqual(normalizePath("/es/account/YMF-ABCDE"), { path: "/account/project", locale: "es" });
  assert.equal(normalizePath("/dashboard"), null);
  assert.equal(normalizePath("/fr/x"), null);
  assert.equal(normalizePath("https://evil.example/es"), null);
  assert.equal(normalizePath(42), null);
});

test("referrer keeps the host of external sites only", () => {
  assert.equal(referrerHost("https://www.instagram.com/ymfreak_/", ["ymfreak.com"]), "instagram.com");
  assert.equal(referrerHost("https://ymfreak.com/es/services", ["www.ymfreak.com"]), null);
  assert.equal(referrerHost("not a url", []), null);
  assert.equal(referrerHost(undefined, []), null);
});

test("visitor ids are anonymous and rotate daily", () => {
  const a = dailyVisitor("s", "1.2.3.4", CHROME, new Date("2026-10-08T10:00:00Z"));
  assert.equal(a, dailyVisitor("s", "1.2.3.4", CHROME, new Date("2026-10-08T22:00:00Z")));
  assert.notEqual(a, dailyVisitor("s", "1.2.3.4", CHROME, new Date("2026-10-09T10:00:00Z")));
  assert.notEqual(a, dailyVisitor("s", "1.2.3.5", CHROME, new Date("2026-10-08T10:00:00Z")));
  assert.ok(!a.includes("1.2.3.4"));
});

test("utm source is sanitised", () => {
  assert.equal(cleanUtm(" Instagram "), "instagram");
  assert.equal(cleanUtm("<script>"), "script");
  assert.equal(cleanUtm(""), null);
});


test("channels come from utm_source first, then the referring site", () => {
  assert.equal(channelOf("ig", null), "instagram");
  assert.equal(channelOf("instagram", "google.com"), "instagram");
  assert.equal(channelOf(null, "l.instagram.com"), "instagram");
  assert.equal(channelOf(null, "m.youtube.com"), "youtube");
  assert.equal(channelOf(null, "youtu.be"), "youtube");
  assert.equal(channelOf(null, "google.com.do"), "google");
  assert.equal(channelOf(null, "t.co"), "x");
  assert.equal(channelOf(null, "lm.facebook.com"), "facebook");
  assert.equal(channelOf(null, "somesite.com"), "somesite.com");
  assert.equal(channelOf(null, null), null);
  assert.equal(cleanLabel("Spotify"), "spotify");
  assert.equal(cleanLabel("<x>"), "x");
});
