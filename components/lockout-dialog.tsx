"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { IconLock, IconClock, IconBan } from "@tabler/icons-react"

interface LockoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  retryAfter: number
  totalWindow?: number
  lockoutStrikes?: number
  banned?: boolean
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) {
    return `${m}m ${s}s`
  }
  return `${s}s`
}

export function LockoutDialog({
  open,
  onOpenChange,
  retryAfter,
  totalWindow,
  lockoutStrikes = 0,
  banned = false,
}: LockoutDialogProps) {
  if (banned) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
                <IconBan className="size-5 text-destructive" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle>Account Permanently Banned</DialogTitle>
              </div>
            </div>
            <DialogDescription>
              Your account has been permanently banned due to excessive failed login attempts.
              Please contact an administrator to restore access.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
              <IconLock className="size-5 text-destructive" />
            </div>
            <div className="space-y-0.5">
              <DialogTitle>Account Temporarily Locked</DialogTitle>
              {lockoutStrikes > 0 && (
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {lockoutStrikes === 1 ? "1st" : lockoutStrikes === 2 ? "2nd" : lockoutStrikes === 3 ? "3rd" : `${lockoutStrikes}th`} lockout
                </div>
              )}
            </div>
          </div>
          <DialogDescription>
            Too many failed login attempts.{" "}
            {lockoutStrikes >= 3
              ? "Your account has been locked for an extended period due to repeated violations."
              : "Please wait before trying again."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconClock className="size-4" />
            <span>Try again in</span>
          </div>
          <div className="text-3xl font-mono font-bold tracking-wider text-foreground">
            {formatTime(retryAfter)}
          </div>
          <div className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-destructive transition-all duration-1000 ease-linear"
              style={{
                width: `${totalWindow ? (retryAfter / totalWindow) * 100 : (retryAfter / 60) * 100}%`,
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
