"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export type AdminSignInResult =
  | { success: true }
  | { success: false; error: string };

export async function adminSignIn(email: string, password: string): Promise<AdminSignInResult> {
  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });

    if (!result) {
      return { success: false, error: "Invalid email or password" };
    }

    if (result.user.role !== "admin") {
      await auth.api.signOut({ headers: await headers() });
      return { success: false, error: "Not authorized. Admin access required." };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Invalid email or password" };
  }
}
