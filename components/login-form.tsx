"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { LockoutDialog } from "@/components/lockout-dialog";
import { IconAlertCircle, IconEye, IconEyeOff, IconLock, IconClock } from "@tabler/icons-react";

const LOCKOUT_STORAGE_KEY = "login-lockout-until";
const LOCKOUT_DURATION = 60; // seconds, matches rate limit window

function getStoredLockoutEnd(): number | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(LOCKOUT_STORAGE_KEY);
  if (!stored) return null;
  const end = parseInt(stored, 10);
  if (isNaN(end) || Date.now() >= end) {
    localStorage.removeItem(LOCKOUT_STORAGE_KEY);
    return null;
  }
  return end;
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

  const [lockoutOpen, setLockoutOpen] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const wasLockedRef = useRef(false);

  // Restore lockout state from localStorage on mount
  useEffect(() => {
    const end = getStoredLockoutEnd();
    if (end !== null) {
      const remaining = Math.ceil((end - Date.now()) / 1000);
      setRetryAfter(remaining);
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

  // Handle lockout expiry — closes dialog and clears storage
  useEffect(() => {
    if (lockoutRemaining > 0 || !wasLockedRef.current) return;
    wasLockedRef.current = false;
    setLockoutOpen(false);
    localStorage.removeItem(LOCKOUT_STORAGE_KEY);
  }, [lockoutRemaining]);

  const handleLockoutChange = useCallback((open: boolean) => {
    setLockoutOpen(open);
    // Don't clear lockout state when dialog is dismissed.
    // The form stays locked with the countdown until it naturally expires.
  }, []);

  function handleRateLimit() {
    const lockoutUntil = Date.now() + LOCKOUT_DURATION * 1000;
    localStorage.setItem(LOCKOUT_STORAGE_KEY, String(lockoutUntil));
    setRetryAfter(LOCKOUT_DURATION);
    setLockoutRemaining(LOCKOUT_DURATION);
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
        handleRateLimit();
      } else {
        setError(error.message || "Invalid email or password");
      }
    } else if (data) {
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

      <LockoutDialog open={lockoutOpen} onOpenChange={handleLockoutChange} retryAfter={lockoutRemaining} />
    </>
  );
}
