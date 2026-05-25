"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export type SignInResult =
  | { success: true }
  | { success: false; rateLimited: boolean; error: string };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });

    if (!result) {
      return { success: false, rateLimited: false, error: "Invalid email or password" };
    }

    return { success: true };
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status;
    if (status === 429) {
      return { success: false, rateLimited: true, error: "Too many attempts" };
    }
    const message = (e as { message?: string })?.message;
    return { success: false, rateLimited: false, error: message || "Invalid email or password" };
  }
}
