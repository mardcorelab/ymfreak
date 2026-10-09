import { test } from "node:test";
import assert from "node:assert/strict";
import { youtubeRefs } from "../../src/lib/youtube-refs";

test("finds videos and playlists in YouTube and YouTube Music links", () => {
  const r = youtubeRefs([
    "https://www.youtube.com/watch?v=abcdefghijk",
    "https://youtu.be/ABCDEFGHIJK?si=xyz",
    "https://www.youtube.com/shorts/zzzzzzzzzzz",
    "https://music.youtube.com/playlist?list=OLAK5uy_abcdefghijklmnopqrstuvwxyz12345",
    "https://music.youtube.com/watch?v=abcdefghijk&list=OLAK5uy_other", // a video inside an album: count the video
    "https://open.spotify.com/album/577TEkqeYU0F3iqerqpq45",
    "not a url",
    null,
  ]);
  assert.deepEqual(r.videos, ["abcdefghijk", "ABCDEFGHIJK", "zzzzzzzzzzz"]);
  assert.deepEqual(r.playlists, ["OLAK5uy_abcdefghijklmnopqrstuvwxyz12345"]);
});
