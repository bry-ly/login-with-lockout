"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { signIn } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { LockoutDialog } from "@/components/lockout-dialog";
import { IconAlertCircle, IconEye, IconEyeOff, IconLock, IconClock, IconAlertTriangle } from "@tabler/icons-react";
import { getLockoutDuration, getLockoutLabel, incrementStrike, resetStrikes, getStrikeCount } from "@/lib/lockout";

const LOCKOUT_STORAGE_KEY = "login-lockout-until";
const LOCKOUT_WINDOW_KEY = "login-lockout-window";
const MAX_ATTEMPTS = 4; // server max:4 → 429 on 5th request; client counts down from 4

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
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});
  const [remainingAttempts, setRemainingAttempts] = useState(MAX_ATTEMPTS);

  const [lockoutOpen, setLockoutOpen] = useState(() => getStoredLockoutEnd() !== null);
  const [retryAfter, setRetryAfter] = useState(() => {
    const end = getStoredLockoutEnd();
    if (end === null) return 0;
    const remaining = Math.ceil((end - Date.now()) / 1000);
    const totalWindow = getStoredLockoutWindow();
    return Math.max(remaining, totalWindow);
  });
  const [lockoutRemaining, setLockoutRemaining] = useState(() => {
    const end = getStoredLockoutEnd();
    return end !== null ? Math.ceil((end - Date.now()) / 1000) : 0;
  });
  const [lockoutStrikes, setLockoutStrikes] = useState(() => getStrikeCount("login"));
  const wasLockedRef = useRef(false);

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

  const handleLockoutChange = useCallback((open: boolean) => {
    setLockoutOpen(open);
    // Don't clear lockout state when dialog is dismissed.
    // The form stays locked with the countdown until it naturally expires.
  }, []);

  function handleRateLimit() {
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

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    if (!validate()) return;

    setIsLoading(true);

    const result = await signIn(email, password);

    if (!result.success) {
      if (result.rateLimited) {
        handleRateLimit();
      } else {
        setError(result.error);
        const next = remainingAttempts - 1;
        if (next <= 0) {
          handleRateLimit();
        } else {
          setRemainingAttempts(next);
        }
      }
    } else {
      setRemainingAttempts(MAX_ATTEMPTS);
      setLockoutStrikes(0);
      localStorage.setItem("last-login-strike-count", String(lockoutStrikes));
      resetStrikes("login");
      toast.success("Logged in successfully!");
      router.push("/dashboard");
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
            {!isLocked && remainingAttempts < MAX_ATTEMPTS && remainingAttempts > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-sm bg-amber-50 dark:bg-amber-950/20 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                <IconAlertTriangle className="size-3.5 shrink-0" />
                <span>
                  {remainingAttempts} of {MAX_ATTEMPTS} attempts remaining
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                {isLocked && (
                  <div className="rounded-sm bg-destructive/10 p-3 text-xs text-destructive">
                    <div className="flex items-center justify-center gap-2">
                      <IconClock className="size-3.5 shrink-0" />
                      <span>
                        Locked. Try again in <span className="font-medium tabular-nums">{formatTime(lockoutRemaining)}</span>
                      </span>
                    </div>
                    {lockoutStrikes > 0 && <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-widest text-destructive/60">{getLockoutLabel(lockoutStrikes)}</p>}
                  </div>
                )}

                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@gmail.com"
                    value={email}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                    aria-invalid={!!validationErrors.email || !!error ? true : undefined}
                    disabled={isLoading || isLocked}
                  />
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
