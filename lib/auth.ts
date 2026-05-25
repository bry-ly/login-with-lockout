import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "./prisma";
import { nextCookies } from "better-auth/next-js";
import { MAX_ATTEMPTS, RATE_LIMIT_WINDOW } from "./rate-limit-config";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  emailAndPassword: { enabled: true },
  rateLimit: {
    enabled: true,
    window: RATE_LIMIT_WINDOW,
    max: 100,
    customRules: {
      "/sign-in/email": {
        window: RATE_LIMIT_WINDOW,
        max: MAX_ATTEMPTS,
      },
    },
    storage: "database",
  },
  plugins: [admin(), nextCookies()],
});
