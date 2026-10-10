/**
 * Most played first. Releases without a known count keep their dashboard
 * order, after the ones with counts. Stable: equal counts keep their order.
 */
export function byViews<T extends { slug: string }>(items: T[], views?: Record<string, number>): T[] {
  if (!views) return items;
  const plays = (slug: string) => views[slug] ?? -1;
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => plays(b.item.slug) - plays(a.item.slug) || a.i - b.i)
    .map(({ item }) => item);
}
