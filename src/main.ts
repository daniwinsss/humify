import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const profile = await prisma.writingProfile.create({
    data: {
      name: "Demo Profile",
      description: "Created by CRUD demo",
      tone: "friendly",
      formality: 70,
      customInstructions: "Keep it brief.",
    },
  });
  console.log("Created:", profile);

  const found = await prisma.writingProfile.findUnique({ where: { id: profile.id } });
  console.log("Read:", found);

  const updated = await prisma.writingProfile.update({
    where: { id: profile.id },
    data: { description: "Updated by CRUD demo" },
  });
  console.log("Updated:", updated);

  const deleted = await prisma.writingProfile.delete({ where: { id: profile.id } });
  console.log("Deleted:", deleted);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
