import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("Starting database seed...");

  // Seed Companies
  const companies = await Promise.all([
    prisma.company.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        name: "OpenAI",
        website: "https://chat.com",
      },
    }),
    prisma.company.upsert({
      where: { id: 2 },
      update: {},
      create: {
        id: 2,
        name: "anthropic",
        website: "https://claud.ai",
      },
    }),
    prisma.company.upsert({
      where: { id: 3 },
      update: {},
      create: {
        id: 3,
        name: "google",
        website: "https://gemini.google.com",
      },
    }),
  ]);
  console.log(`Created ${companies.length} companies`);

  // Seed Providers
  const providers = await Promise.all([
    prisma.provider.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        name: "Google API",
        website: "https://aistudio.google.com",
      },
    }),
    prisma.provider.upsert({
      where: { id: 2 },
      update: {},
      create: {
        id: 2,
        name: "Claude API",
        website: "https://claude.ai",
      },
    }),
    prisma.provider.upsert({
      where: { id: 3 },
      update: {},
      create: {
        id: 3,
        name: "OpenAI",
        website: "https://api.chat.com",
      },
    }),
  ]);
  console.log(`Created ${providers.length} providers`);

  // Seed Models
  const models = await Promise.all([
    prisma.model.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        name: "Google: Gemini 3 Flash Preview",
        slug: "google/gemini-3-flash-preview",
        companyId: 3,
      },
    }),
    prisma.model.upsert({
      where: { id: 2 },
      update: {},
      create: {
        id: 2,
        name: "Google: Gemini 2.5 Pro",
        slug: "google/gemini-2.5-pro",
        companyId: 3,
      },
    }),
    prisma.model.upsert({
      where: { id: 3 },
      update: {},
      create: {
        id: 3,
        name: "Google: Gemini 2.5 Flash",
        slug: "google/gemini-2.5-flash",
        companyId: 3,
      },
    }),
  ]);
  console.log(`Created ${models.length} models`);

  // Seed Model Provider Mappings
  const mappings = await Promise.all([
    prisma.modelProviderMapping.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        modelId: 1,
        providerId: 1,
        inputTokenCost: 0,
        outputTokenCost: 0,
      },
    }),
    prisma.modelProviderMapping.upsert({
      where: { id: 2 },
      update: {},
      create: {
        id: 2,
        modelId: 2,
        providerId: 1,
        inputTokenCost: 0,
        outputTokenCost: 0,
      },
    }),
    prisma.modelProviderMapping.upsert({
      where: { id: 3 },
      update: {},
      create: {
        id: 3,
        modelId: 3,
        providerId: 1,
        inputTokenCost: 0,
        outputTokenCost: 0,
      },
    }),
  ]);
  console.log(`Created ${mappings.length} model-provider mappings`);

  console.log("Database seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
