"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  strikes: number;
  lockedUntil: string | null;
};

type LockoutStats = {
  currentlyLocked: number;
  topUsers: { email: string; strikes: number; lockedUntil: Date | null }[];
  totalStrikes: number;
};

export type DashboardData = {
  users: UserRow[];
  stats: LockoutStats;
};

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") {
    return null;
  }
  return session;
}

export async function getDashboardData(): Promise<DashboardData> {
  const session = await requireAdmin();
  if (!session) return { users: [], stats: { currentlyLocked: 0, topUsers: [], totalStrikes: 0 } };

  const [userResult, lockoutRecords] = await Promise.all([
    auth.api.listUsers({ query: { limit: 100 }, headers: await headers() }),
    prisma.loginLockout.findMany({ orderBy: { strikes: "desc" } }),
  ]);

  const now = new Date();
  const lockoutMap = new Map(lockoutRecords.map((r) => [r.email, r]));

  const users: UserRow[] = (userResult.users ?? []).map((u) => {
    const lockout = lockoutMap.get(u.email);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role ?? "user",
      banned: u.banned ?? false,
      strikes: lockout?.strikes ?? 0,
      lockedUntil: lockout?.lockedUntil?.toISOString() ?? null,
    };
  });

  const stats: LockoutStats = {
    currentlyLocked: lockoutRecords.filter((r) => r.lockedUntil && r.lockedUntil > now).length,
    topUsers: lockoutRecords.slice(0, 5),
    totalStrikes: lockoutRecords.reduce((sum, r) => sum + r.strikes, 0),
  };

  return { users, stats };
}

export async function unlockUser(email: string): Promise<DashboardData> {
  const session = await requireAdmin();
  if (!session) return { users: [], stats: { currentlyLocked: 0, topUsers: [], totalStrikes: 0 } };

  await prisma.loginLockout.delete({ where: { email } }).catch(() => {});
  await prisma.user.update({ where: { email }, data: { banned: false, banReason: null } }).catch(() => {});
  return getDashboardData();
}

export async function deleteUser(email: string): Promise<DashboardData> {
  const session = await requireAdmin();
  if (!session) return { users: [], stats: { currentlyLocked: 0, topUsers: [], totalStrikes: 0 } };

  await prisma.loginLockout.delete({ where: { email } }).catch(() => {});
  await prisma.user.delete({ where: { email } }).catch(() => {});
  return getDashboardData();
}
