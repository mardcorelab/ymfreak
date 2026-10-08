import { test } from "node:test";
import assert from "node:assert/strict";
import { mediaLinkUrl, parseMediaLink } from "../../src/lib/media-link";
import { centsToDollars, dollarsToCents, lines, optionalInt, slugify } from "../../src/lib/form-data";

test("Spotify links (share links, locale prefix, tracks) parse to provider + id", () => {
  assert.deepEqual(parseMediaLink("https://open.spotify.com/album/577TEkqeYU0F3iqerqpq45?si=XeLOFeMpQCC_jZFk-w74Tg"), {
    provider: "SPOTIFY",
    id: "album/577TEkqeYU0F3iqerqpq45",
    url: "https://open.spotify.com/album/577TEkqeYU0F3iqerqpq45",
  });
  assert.equal(parseMediaLink("https://open.spotify.com/intl-es/track/22zAix2FUFf0VKfs9MHp5U")?.id, "track/22zAix2FUFf0VKfs9MHp5U");
});

test("YouTube links in their usual shapes parse to the video id", () => {
  for (const link of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
  ]) {
    assert.equal(parseMediaLink(link)?.id, "dQw4w9WgXcQ", link);
  }
});

test("anything else is rejected", () => {
  for (const bad of [
    "",
    "not a url",
    "http://open.spotify.com/album/577TEkqeYU0F3iqerqpq45",
    "https://open.spotify.com/artist/577TEkqeYU0F3iqerqpq45",
    "https://open.spotify.com.evil.com/album/577TEkqeYU0F3iqerqpq45",
    "https://evil.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "javascript:alert(1)",
  ]) {
    assert.equal(parseMediaLink(bad), null, bad);
  }
});

test("stored ids rebuild the public link", () => {
  assert.equal(mediaLinkUrl("SPOTIFY", "album/577TEkqeYU0F3iqerqpq45"), "https://open.spotify.com/album/577TEkqeYU0F3iqerqpq45");
  assert.equal(mediaLinkUrl("YOUTUBE", "dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(mediaLinkUrl(null, null), "");
});

test("dollar amounts typed by a person become exact cents", () => {
  assert.equal(dollarsToCents("150"), 15000);
  assert.equal(dollarsToCents("$70"), 7000);
  assert.equal(dollarsToCents("75.5"), 7550);
  assert.equal(dollarsToCents("1,250.99"), 125099);
  assert.ok(Number.isNaN(dollarsToCents("abc")));
  assert.ok(Number.isNaN(dollarsToCents("1.999")));
  assert.ok(Number.isNaN(dollarsToCents("-5")));
  assert.equal(centsToDollars(15000), "150");
  assert.equal(centsToDollars(7550), "75.50");
});

test("form readers", () => {
  const fd = new FormData();
  fd.set("l", " uno \n\n dos\r\n");
  fd.set("n", "12");
  fd.set("bad", "12a");
  assert.deepEqual(lines(fd, "l"), ["uno", "dos"]);
  assert.equal(optionalInt(fd, "n"), 12);
  assert.equal(optionalInt(fd, "missing"), null);
  assert.ok(Number.isNaN(optionalInt(fd, "bad")!));
  assert.equal(slugify("Producción Completa!"), "produccion-completa");
});
