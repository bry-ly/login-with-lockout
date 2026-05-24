"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { IconAlertCircle, IconCircleCheck, IconEye, IconEyeOff } from "@tabler/icons-react";

const LOCKOUT_STORAGE_KEY = "signup-lockout-until";
const LOCKOUT_DURATION = 60;

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

  useEffect(() => {
    if (getStoredLockoutEnd() !== null) {
      setError("Too many attempts. Please try again later.");
    }
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
        const lockoutUntil = Date.now() + LOCKOUT_DURATION * 1000;
        localStorage.setItem(LOCKOUT_STORAGE_KEY, String(lockoutUntil));
        setError("Too many attempts. Please try again later.");
      } else {
        setError(error.message || "Failed to create account");
      }
    } else if (data) {
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

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Enter your details to create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  aria-invalid={!!validationErrors.name ? true : undefined}
                  disabled={isLoading}
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
                  disabled={isLoading}
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
                    disabled={isLoading}
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
                    disabled={isLoading}
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

              {error && (
                <div className="flex items-center gap-2 rounded-sm bg-destructive/10 p-3 text-xs text-destructive">
                  <IconAlertCircle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Field>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Spinner />
                      Creating account...
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
                    tabIndex={isLoading ? -1 : 0}
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
  );
}
