import { prisma } from "./prisma";
import { MAX_ATTEMPTS, PROGRESSIVE_DURATIONS } from "./rate-limit-config";

export type LockoutResult = {
  locked: boolean;
  retryAfter?: number;
  strikes: number;
  banned?: boolean;
};

const FAR_FUTURE = new Date(8640000000000000);

function isBannedLocked(lockedUntil: Date) {
  return lockedUntil.getTime() >= FAR_FUTURE.getTime();
}

export async function checkLockout(email: string): Promise<LockoutResult> {
  const record = await prisma.loginLockout.findUnique({ where: { email } });
  if (!record || !record.lockedUntil) {
    return { locked: false, strikes: record?.strikes ?? 0 };
  }

  if (isBannedLocked(record.lockedUntil)) {
    return { locked: true, strikes: record.strikes, banned: true };
  }

  const now = Date.now();
  if (record.lockedUntil.getTime() <= now) {
    await prisma.loginLockout.update({
      where: { email },
      data: { lockedUntil: null },
    });
    return { locked: false, strikes: record.strikes };
  }

  const retryAfter = Math.ceil((record.lockedUntil.getTime() - now) / 1000);
  return { locked: true, retryAfter, strikes: record.strikes };
}

async function banUser(email: string) {
  await prisma.user
    .update({
      where: { email },
      data: {
        banned: true,
        banReason: "Permanent ban after 4 lockout cycles",
      },
    })
    .catch(() => {});
  await prisma.loginLockout.upsert({
    where: { email },
    create: { email, strikes: 0, lockedUntil: FAR_FUTURE },
    update: { lockedUntil: FAR_FUTURE },
  });
}

export async function recordFailedAttempt(email: string): Promise<LockoutResult> {
  const record = await prisma.loginLockout.upsert({
    where: { email },
    create: { email, strikes: 1, lockedUntil: null },
    update: { strikes: { increment: 1 } },
  });

  const now = Date.now();
  const currentlyLocked = record.lockedUntil && record.lockedUntil.getTime() > now;

  if (currentlyLocked) {
    const retryAfter = Math.ceil((record.lockedUntil!.getTime() - now) / 1000);
    return { locked: true, retryAfter, strikes: record.strikes };
  }

  if (record.strikes >= MAX_ATTEMPTS && record.strikes % MAX_ATTEMPTS === 0) {
    const cycle = Math.floor(record.strikes / MAX_ATTEMPTS) - 1;

    if (cycle >= PROGRESSIVE_DURATIONS.length) {
      await banUser(email);
      return { locked: true, banned: true, strikes: record.strikes };
    }

    const duration = PROGRESSIVE_DURATIONS[cycle];
    await prisma.loginLockout.update({
      where: { email },
      data: { lockedUntil: new Date(now + duration * 1000) },
    });

    return { locked: true, retryAfter: duration, strikes: record.strikes };
  }

  return { locked: false, strikes: record.strikes };
}

export async function resetLockout(email: string): Promise<void> {
  await prisma.loginLockout.delete({ where: { email } }).catch(() => {});
}
