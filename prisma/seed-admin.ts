import { prisma } from "../lib/prisma";

const email = process.argv[2];

if (!email) {
  console.error("Usage: pnpm db:seed:admin <email>");
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findFirst({ where: { email } });

  if (!user) {
    console.error(`User with email "${email}" not found. Make sure they've signed up first.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "admin" },
  });

  console.log(`Promoted ${email} to admin.`);
}

main().catch((e) => {
  console.error("Error seeding admin:", e);
  process.exit(1);
});
