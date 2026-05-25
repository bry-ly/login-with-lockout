import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

async function main() {
  const created = await auth.api.signUpEmail({
    body: {
      email: "test@example.com",
      password: "password123",
      name: "Test User",
    },
  });

  console.log(`Seeded user: ${created.user.email} (${created.user.id})`);

  await prisma.user.update({
    where: { id: created.user.id },
    data: { role: "admin" },
  });

  console.log(`Promoted ${created.user.email} to admin.`);
}

main().catch((e) => {
  console.error("Error seeding user:", e);
  process.exit(1);
});
