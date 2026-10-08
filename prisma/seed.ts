/**
 * Fills an empty database with the initial content. Safe to run more than
 * once: it never overwrites rows you have edited in the dashboard (upserts
 * only create missing rows; existing ones are left untouched).
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { serviceSeeds } from "../content/services";
import { bookingSeed, businessRulesSeed, contactSeed, paymentSeed } from "../content/business";
import { knowledgeSeeds } from "../content/knowledge";
import { achievementSeeds, portfolioSeeds } from "../content/achievements";
import { parseSetting } from "../src/server/settings/schemas";

const prisma = new PrismaClient();

async function main() {
  for (const s of serviceSeeds) {
    await prisma.service.upsert({ where: { slug: s.slug }, update: {}, create: s });
  }

  const settings = {
    business_rules: parseSetting("business_rules", businessRulesSeed),
    contact: parseSetting("contact", contactSeed),
    payment: parseSetting("payment", paymentSeed),
    booking: parseSetting("booking", bookingSeed),
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  const existingFaq = await prisma.knowledgeEntry.count();
  if (existingFaq === 0) {
    await prisma.knowledgeEntry.createMany({
      data: knowledgeSeeds.map(({ key: _key, ...k }, i) => ({ ...k, sortOrder: i })),
    });
  }

  for (const p of portfolioSeeds) {
    await prisma.portfolioItem.upsert({ where: { slug: p.slug }, update: {}, create: p });
  }

  if ((await prisma.achievement.count()) === 0) {
    for (const { key: _key, portfolioSlug, ...a } of achievementSeeds) {
      const item = portfolioSlug
        ? await prisma.portfolioItem.findUnique({ where: { slug: portfolioSlug }, select: { id: true } })
        : null;
      await prisma.achievement.create({ data: { ...a, portfolioId: item?.id ?? null } });
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: "ADMIN" },
      create: { email: adminEmail, role: "ADMIN", name: "YM Freak" },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
