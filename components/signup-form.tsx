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
import { IconAlertCircle, IconCircleCheck, IconClock, IconEye, IconEyeOff, IconLock } from "@tabler/icons-react";
import {
  incrementStrike,
  getLockoutDuration,
  getLockoutLabel,
  getStrikeCount,
  resetStrikes,
} from "@/lib/lockout";

const LOCKOUT_STORAGE_KEY = "signup-lockout-until";
const LOCKOUT_WINDOW_KEY = "signup-lockout-window";

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

export function SignUpForm({ className, ...props }: React.ComponentProps<"div">) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

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

  // Sync strike count from localStorage on mount
  useEffect(() => {
    setLockoutStrikes(getStrikeCount("signup"));
  }, []);

  // Handle lockout expiry — closes dialog and clears storage
  useEffect(() => {
    if (lockoutRemaining > 0 || !wasLockedRef.current) return;
    wasLockedRef.current = false;
    setLockoutOpen(false);
    localStorage.removeItem(LOCKOUT_STORAGE_KEY);
    localStorage.removeItem(LOCKOUT_WINDOW_KEY);
  }, [lockoutRemaining]);

  const handleLockoutChange = useCallback((open: boolean) => {
    setLockoutOpen(open);
  }, []);

  function handleFieldChange(field: "name" | "email" | "password" | "confirmPassword", value: string) {
    const setters: Record<string, React.Dispatch<React.SetStateAction<string>>> = {
      name: setName,
      email: setEmail,
      password: setPassword,
      confirmPassword: setConfirmPassword,
    };
    setters[field](value);
    // Clear field-level validation error when user starts typing
    setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const errors: typeof validationErrors = {};

    if (!name.trim()) {
      errors.name = "Name is required";
    } else if (name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    }

    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address";
    }

    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your password";
    } else if (password && confirmPassword !== password) {
      errors.confirmPassword = "Passwords do not match";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleRateLimit(_retryAfterSeconds: number) {
    const strikes = incrementStrike("signup");
    setLockoutStrikes(strikes);
    const duration = getLockoutDuration("signup");
    const lockoutUntil = Date.now() + duration * 1000;
    localStorage.setItem(LOCKOUT_STORAGE_KEY, String(lockoutUntil));
    localStorage.setItem(LOCKOUT_WINDOW_KEY, String(duration));
    setRetryAfter(duration);
    setLockoutRemaining(duration);
    setLockoutOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setValidationErrors({});

    if (!validate()) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await authClient.signUp.email({
      name,
      email,
      password,
    });

    if (error) {
      if (error.status === 429) {
        handleRateLimit(0); // duration is calculated from strikes
      } else {
        setError(error.message || "Failed to create account");
      }
    } else if (data) {
      setLockoutStrikes(0);
      resetStrikes("signup");
      toast.success("Account created! Redirecting to login...");
      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    }

    setIsLoading(false);
  }

  if (success) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconCircleCheck className="size-6 text-green-600" />
              <CardTitle>Account created!</CardTitle>
            </div>
            <CardDescription>
              Your account has been created successfully. Redirecting you...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isLocked = lockoutRemaining > 0;

  return (
    <>
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle>Create an account</CardTitle>
            <CardDescription>Enter your details to create a new account</CardDescription>
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
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    aria-invalid={!!validationErrors.name ? true : undefined}
                    disabled={isLoading || isLocked}
                  />
                  {validationErrors.name && <FieldError>{validationErrors.name}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                    aria-invalid={!!validationErrors.email ? true : undefined}
                    disabled={isLoading || isLocked}
                  />
                  {validationErrors.email && <FieldError>{validationErrors.email}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a secure password"
                      value={password}
                      onChange={(e) => handleFieldChange("password", e.target.value)}
                      aria-invalid={!!validationErrors.password ? true : undefined}
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
                <Field>
                  <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => handleFieldChange("confirmPassword", e.target.value)}
                      aria-invalid={!!validationErrors.confirmPassword ? true : undefined}
                      disabled={isLoading || isLocked}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
                    </button>
                  </div>
                  {validationErrors.confirmPassword && <FieldError>{validationErrors.confirmPassword}</FieldError>}
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
                        Creating account...
                      </>
                    ) : isLocked ? (
                      <>
                        <IconLock className="size-4" />
                        Locked
                      </>
                    ) : (
                      "Sign up"
                    )}
                  </Button>
                  <div className="text-center text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <a
                      href="/"
                      className="underline underline-offset-3 hover:text-foreground"
                      tabIndex={isLoading || isLocked ? -1 : 0}
                    >
                      Login
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
