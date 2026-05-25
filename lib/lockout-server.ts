import { prisma } from "./prisma";
import { MAX_ATTEMPTS, PROGRESSIVE_DURATIONS } from "./rate-limit-config";

export type LockoutResult = {
  locked: boolean;
  retryAfter?: number;
  strikes: number;
};

export async function checkLockout(email: string): Promise<LockoutResult> {
  const record = await prisma.loginLockout.findUnique({ where: { email } });
  if (!record || !record.lockedUntil) {
    return { locked: false, strikes: record?.strikes ?? 0 };
  }

  const now = Date.now();
  if (record.lockedUntil.getTime() <= now) {
    await prisma.loginLockout.update({
      where: { email },
      data: { lockedUntil: null, strikes: 0 },
    });
    return { locked: false, strikes: 0 };
  }

  const retryAfter = Math.ceil((record.lockedUntil.getTime() - now) / 1000);
  return { locked: true, retryAfter, strikes: record.strikes };
}

export async function recordFailedAttempt(email: string): Promise<LockoutResult> {
  const record = await prisma.loginLockout.upsert({
    where: { email },
    create: { email, strikes: 1 },
    update: { strikes: { increment: 1 } },
  });

  if (record.strikes >= MAX_ATTEMPTS) {
    const overflow = record.strikes - MAX_ATTEMPTS;
    const level = Math.min(overflow, PROGRESSIVE_DURATIONS.length - 1);
    const duration = PROGRESSIVE_DURATIONS[Math.max(0, level)];
    const lockedUntil = new Date(Date.now() + duration * 1000);

    await prisma.loginLockout.update({
      where: { email },
      data: { lockedUntil },
    });

    return { locked: true, retryAfter: duration, strikes: record.strikes };
  }

  return { locked: false, strikes: record.strikes };
}

export async function resetLockout(email: string): Promise<void> {
  await prisma.loginLockout.delete({ where: { email } }).catch(() => {});
}
