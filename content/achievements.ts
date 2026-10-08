/**
 * INITIAL DATA ONLY — seeded into Achievement / PortfolioItem.
 * Only facts YM Freak has provided go here. Gold/platinum certifications are
 * added once the specific songs are confirmed.
 */
export const achievementSeeds = [
  {
    key: "latin-grammy-2026",
    kind: "NOMINATION" as const,
    titleEs: "Nominación al Latin Grammy 2026",
    titleEn: "2026 Latin Grammy Nomination",
    detailEs: "Mejor Álbum de Merengue-Bachata — co-productor de «No Era El Plan», de Gabriel Pagán.",
    detailEn: "Best Merengue-Bachata Album — co-producer of “No Era El Plan” by Gabriel Pagán.",
    year: 2026,
    highlight: true,
    sortOrder: 1,
  },
];

/** Portfolio items arrive with YM Freak's material (covers, Spotify/YouTube ids). */
export const portfolioSeeds: {
  slug: string;
  title: string;
  artist: string;
  workTypes: string[];
  year: number | null;
  embedProvider: "SPOTIFY" | "YOUTUBE" | null;
  embedId: string | null;
  featured: boolean;
}[] = [];
