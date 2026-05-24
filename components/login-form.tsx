"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { LockoutDialog } from "@/components/lockout-dialog";
import { IconAlertCircle, IconEye, IconEyeOff, IconLock, IconClock, IconAlertTriangle } from "@tabler/icons-react";
import {
  getLockoutDuration,
  getLockoutLabel,
  incrementStrike,
  resetStrikes,
  getStrikeCount,
} from "@/lib/lockout";

const LOCKOUT_STORAGE_KEY = "login-lockout-until";
const LOCKOUT_WINDOW_KEY = "login-lockout-window";
const MAX_ATTEMPTS = 4; // server allows 5 requests before lockout (max:5 triggers on 6th); client shows attempts before lockout

function getStoredLockoutEnd(): number | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(LOCKOUT_STORAGE_KEY);
  if (!stored) return null;
  const end = parseInt(stored, 10);
  if (isNaN(end) || Date.now() >= end) {
    localStorage.removeItem(LOCKOUT_STORAGE_KEY);
    localStorage.removeItem(LOCKOUT_WINDOW_KEY);
    return null;
  }
  return end;
}

function getStoredLockoutWindow(): number {
  if (typeof window === "undefined") return 60;
  const stored = localStorage.getItem(LOCKOUT_WINDOW_KEY);
  if (!stored) return 60;
  const parsed = parseInt(stored, 10);
  return isNaN(parsed) ? 60 : parsed;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});
  const [remainingAttempts, setRemainingAttempts] = useState(MAX_ATTEMPTS);

  const [lockoutOpen, setLockoutOpen] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [lockoutStrikes, setLockoutStrikes] = useState(0);
  const wasLockedRef = useRef(false);

  // Restore lockout state from localStorage on mount
  useEffect(() => {
    const end = getStoredLockoutEnd();
    if (end !== null) {
      const remaining = Math.ceil((end - Date.now()) / 1000);
      const totalWindow = getStoredLockoutWindow();
      setRetryAfter(Math.max(remaining, totalWindow));
      setLockoutRemaining(remaining);
      setLockoutOpen(true);
    }
  }, []);

  // Countdown timer for the form lockout display
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    wasLockedRef.current = true;
    const interval = setInterval(() => {
      setLockoutRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  // Handle lockout expiry — closes dialog, clears storage, resets attempt counter
  useEffect(() => {
    if (lockoutRemaining > 0 || !wasLockedRef.current) return;
    wasLockedRef.current = false;
    setLockoutOpen(false);
    setRemainingAttempts(MAX_ATTEMPTS);
    localStorage.removeItem(LOCKOUT_STORAGE_KEY);
    localStorage.removeItem(LOCKOUT_WINDOW_KEY);
  }, [lockoutRemaining]);

  // Sync strike count from localStorage on mount
  useEffect(() => {
    setLockoutStrikes(getStrikeCount("login"));
  }, []);

  const handleLockoutChange = useCallback((open: boolean) => {
    setLockoutOpen(open);
    // Don't clear lockout state when dialog is dismissed.
    // The form stays locked with the countdown until it naturally expires.
  }, []);

  function handleRateLimit(_retryAfterSeconds: number) {
    const strikes = incrementStrike("login");
    setLockoutStrikes(strikes);
    const duration = getLockoutDuration("login");
    const lockoutUntil = Date.now() + duration * 1000;
    localStorage.setItem(LOCKOUT_STORAGE_KEY, String(lockoutUntil));
    localStorage.setItem(LOCKOUT_WINDOW_KEY, String(duration));
    setRetryAfter(duration);
    setLockoutRemaining(duration);
    setRemainingAttempts(0);
    setLockoutOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    if (!validate()) return;

    setIsLoading(true);

    const { data, error } = await authClient.signIn.email({
      email,
      password,
    });

    if (error) {
      if (error.status === 429) {
        handleRateLimit(0); // duration is calculated from strikes
      } else {
        setError(error.message || "Invalid email or password");
        setRemainingAttempts((prev) => Math.max(0, prev - 1));
      }
    } else if (data) {
      setRemainingAttempts(MAX_ATTEMPTS);
      setLockoutStrikes(0);
      resetStrikes("login");
      toast.success("Logged in successfully!");
      window.location.href = "/dashboard";
    }

    setIsLoading(false);
  }

    function handleFieldChange(field: "email" | "password", value: string) {
    if (field === "email") {
      setEmail(value);
    } else {
      setPassword(value);
    }
    // Clear field-level validation error when user starts typing
    setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address";
    }
    if (!password.trim()) {
      errors.password = "Password is required";
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const isLocked = lockoutRemaining > 0;

  return (
    <>
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle>Login to your account</CardTitle>
            <CardDescription>Enter your email and password to login to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                {isLocked && (
                  <div className="flex items-start gap-3 rounded-sm bg-destructive/10 p-3 text-xs text-destructive">
                    <IconLock className="size-4 mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">Account Temporarily Locked</span>
                      {lockoutStrikes > 0 && (
                        <span className="text-[10px] font-medium text-destructive/70 uppercase tracking-wider">
                          {getLockoutLabel(lockoutStrikes)}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <IconClock className="size-3.5" />
                        <span>Try again in {formatTime(lockoutRemaining)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" type="email" placeholder="m@example.com" value={email} onChange={(e) => handleFieldChange("email", e.target.value)} aria-invalid={!!validationErrors.email || !!error ? true : undefined} disabled={isLoading || isLocked} />
                  {validationErrors.email && <FieldError>{validationErrors.email}</FieldError>}
                </Field>
                <Field>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => handleFieldChange("password", e.target.value)}
                      aria-invalid={!!validationErrors.password || !!error ? true : undefined}
                      disabled={isLoading || isLocked}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
                    </button>
                  </div>
                  {validationErrors.password && <FieldError>{validationErrors.password}</FieldError>}
                </Field>

                {!isLocked && error && (
                  <div className="flex items-center gap-2 rounded-sm bg-destructive/10 p-3 text-xs text-destructive">
                    <IconAlertCircle className="size-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {!isLocked && remainingAttempts < MAX_ATTEMPTS && remainingAttempts > 0 && (
                  <div className="flex items-center gap-2 rounded-sm bg-amber-50 dark:bg-amber-950/20 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                    <IconAlertTriangle className="size-3.5 shrink-0" />
                    <span className="flex-1">{remainingAttempts} of {MAX_ATTEMPTS} attempts remaining</span>
                    <div className="flex gap-1">
                      {Array.from({ length: MAX_ATTEMPTS }, (_, i) => (
                        <div
                          key={i}
                          className={`size-2 rounded-full transition-colors duration-300 ${
                            i < remainingAttempts ? 'bg-amber-400 dark:bg-amber-500' : 'bg-amber-200 dark:bg-amber-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <Field>
                  <Button type="submit" className="w-full" disabled={isLoading || isLocked}>
                    {isLoading ? (
                      <>
                        <Spinner />
                        Signing in...
                      </>
                    ) : isLocked ? (
                      <>
                        <IconLock className="size-4" />
                        Locked
                      </>
                    ) : (
                      "Login"
                    )}
                  </Button>
                  <div className="text-center text-xs text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <a href="/signup" className="underline underline-offset-3 hover:text-foreground" tabIndex={isLoading || isLocked ? -1 : 0}>
                      Sign up
                    </a>
                  </div>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>

      <LockoutDialog open={lockoutOpen} onOpenChange={handleLockoutChange} retryAfter={lockoutRemaining} totalWindow={retryAfter} lockoutStrikes={lockoutStrikes} />
    </>
  );
}
