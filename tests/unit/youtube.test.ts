import { test } from "node:test";
import assert from "node:assert/strict";
import { channelIdFromHtml, parseYoutubeFeed } from "../../src/lib/youtube-feed";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>YM Freak</title>
 <entry>
  <id>yt:video:abcdefghijk</id>
  <yt:videoId>abcdefghijk</yt:videoId>
  <title>Mezclando &quot;No Era El Plan&quot; &amp; más</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=abcdefghijk"/>
  <published>2026-09-30T18:00:00+00:00</published>
 </entry>
 <entry>
  <id>yt:video:ZYXWVUTSRQP</id>
  <yt:videoId>ZYXWVUTSRQP</yt:videoId>
  <title>Short del estudio</title>
  <link rel="alternate" href="https://www.youtube.com/shorts/ZYXWVUTSRQP"/>
  <published>2026-09-20T18:00:00+00:00</published>
 </entry>
</feed>`;

test("parses the channel feed and tells shorts apart", () => {
  const v = parseYoutubeFeed(FEED);
  assert.equal(v.length, 2);
  assert.deepEqual(v[0], {
    id: "abcdefghijk",
    title: 'Mezclando "No Era El Plan" & más',
    published: "2026-09-30T18:00:00+00:00",
    url: "https://www.youtube.com/watch?v=abcdefghijk",
    short: false,
  });
  assert.equal(v[1]!.short, true);
  assert.deepEqual(parseYoutubeFeed("<html>nope</html>"), []);
});

test("finds the channel id on a channel page", () => {
  const id = "UC" + "a".repeat(22);
  assert.equal(channelIdFromHtml(`<link rel="canonical" href="https://www.youtube.com/channel/${id}">`), id);
  assert.equal(channelIdFromHtml(`{"externalId":"${id}"}`), id);
  assert.equal(channelIdFromHtml("<html></html>"), null);
});
