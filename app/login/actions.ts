"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { checkLockout, recordFailedAttempt, resetLockout } from "@/lib/lockout-server";

export type SignInResult =
  | { success: true }
  | { success: false; error: string; retryAfter?: number; lockoutStrikes?: number };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const lockout = await checkLockout(email);
  if (lockout.locked) {
    return {
      success: false,
      error: "Account temporarily locked",
      retryAfter: lockout.retryAfter,
      lockoutStrikes: lockout.strikes,
    };
  }

  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });

    if (!result) {
      const next = await recordFailedAttempt(email);
      return {
        success: false,
        error: "Invalid email or password",
        retryAfter: next.locked ? next.retryAfter : undefined,
        lockoutStrikes: next.strikes,
      };
    }

    await resetLockout(email);
    return { success: true };
  } catch {
    const next = await recordFailedAttempt(email);
    return {
      success: false,
      error: "Too many attempts",
      retryAfter: next.locked ? next.retryAfter : undefined,
      lockoutStrikes: next.strikes,
    };
  }
}
