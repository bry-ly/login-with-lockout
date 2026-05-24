import { auth } from "../lib/auth";

async function main() {
  const created = await auth.api.signUpEmail({
    body: {
      email: "test@example.com",
      password: "password123",
      name: "Test User",
    },
  });

  console.log(`Seeded user: ${created.user.email} (${created.user.id})`);
}

main().catch((e) => {
  console.error("Error seeding user:", e);
  process.exit(1);
});
