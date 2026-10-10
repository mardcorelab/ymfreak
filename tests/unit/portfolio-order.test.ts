import { test } from "node:test";
import assert from "node:assert/strict";
import { byViews } from "../../src/lib/portfolio-order";

const items = [{ slug: "a" }, { slug: "b" }, { slug: "c" }, { slug: "d" }, { slug: "e" }];

test("most played first; unknown counts keep the dashboard order at the end", () => {
  const order = byViews(items, { b: 1200, d: 98000, e: 1200 }).map((i) => i.slug);
  assert.deepEqual(order, ["d", "b", "e", "a", "c"]);
});

test("without counts the order is untouched", () => {
  assert.deepEqual(byViews(items).map((i) => i.slug), ["a", "b", "c", "d", "e"]);
});
