/**
 * INITIAL DATA ONLY — seeded into PortfolioItem / Achievement, then edited in the dashboard.
 * Only facts YM Freak has provided go here.
 */

export interface PortfolioSeed {
  slug: string;
  title: string;
  artist: string;
  /** Kind of release, shown next to the year. */
  workTypes: string[];
  year: number | null;
  creditEs: string | null;
  creditEn: string | null;
  /** Spotify's own cover image for the release (hot-linked from Spotify's CDN). */
  coverUrl: string | null;
  embedProvider: "SPOTIFY" | "YOUTUBE" | null;
  /** Spotify id in the form "album/<id>" or "track/<id>", or a YouTube video id. */
  embedId: string | null;
  externalUrl: string | null;
  featured: boolean;
  sortOrder: number;
}

export const portfolioSeeds: PortfolioSeed[] = [
  {
    slug: "no-era-el-plan",
    title: "No Era El Plan",
    artist: "Gabriel Pagán",
    workTypes: ["Álbum"],
    year: 2026,
    creditEs: "Co-producción",
    creditEn: "Co-producer",
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273f343d2223e63a5a7946f11fc",
    embedProvider: "SPOTIFY",
    embedId: "album/577TEkqeYU0F3iqerqpq45",
    externalUrl: "https://open.spotify.com/album/577TEkqeYU0F3iqerqpq45",
    featured: true,
    sortOrder: 1,
  },
  {
    slug: "fake-capo-remix",
    title: "Fake Capo (Remix)",
    artist: "Karetta el Gucci",
    workTypes: ["Single"],
    year: 2020,
    creditEs: "Producción completa",
    creditEn: "Full production",
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273d29cf76aea49cb02adadfa84",
    embedProvider: "SPOTIFY",
    embedId: "album/4cddGZ6rYjXeWY0DpNupXQ",
    externalUrl: "https://open.spotify.com/album/4cddGZ6rYjXeWY0DpNupXQ",
    featured: true,
    sortOrder: 2,
  },
];

export interface AchievementSeed {
  key: string;
  kind: "NOMINATION" | "AWARD" | "CERTIFICATION" | "MILESTONE";
  titleEs: string;
  titleEn: string;
  detailEs: string;
  detailEn: string;
  year: number | null;
  highlight: boolean;
  sortOrder: number;
  portfolioSlug: string | null;
}

export const achievementSeeds: AchievementSeed[] = [
  {
    key: "latin-grammy-2026",
    kind: "NOMINATION",
    titleEs: "Nominación al Latin Grammy",
    titleEn: "Latin Grammy nomination",
    detailEs: "Mejor Álbum de Merengue-Bachata, como co-productor de «No Era El Plan» de Gabriel Pagán.",
    detailEn: "Best Merengue-Bachata Album, as co-producer of “No Era El Plan” by Gabriel Pagán.",
    year: 2026,
    highlight: true,
    sortOrder: 1,
    portfolioSlug: "no-era-el-plan",
  },
  {
    key: "gold-spain-fake-capo",
    kind: "CERTIFICATION",
    titleEs: "Disco de Oro en España",
    titleEn: "Gold record in Spain",
    detailEs: "Como productor de «Fake Capo (Remix)» de Karetta el Gucci.",
    detailEn: "As producer of “Fake Capo (Remix)” by Karetta el Gucci.",
    year: 2021,
    highlight: true,
    sortOrder: 2,
    portfolioSlug: "fake-capo-remix",
  },
];
