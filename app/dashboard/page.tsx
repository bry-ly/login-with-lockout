"use client";

import { authClient } from "@/lib/auth-client";
import { useSignout } from "@/hooks/use-signout";

const { useSession } = authClient;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { IconLogout, IconUser, IconMail, IconCalendar, IconShield } from "@tabler/icons-react";

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const signout = useSignout();

  if (isPending) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Not authenticated</CardTitle>
            <CardDescription>You need to be logged in to view this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/login" className="inline-flex h-8 w-full items-center justify-center gap-1.5 bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-all hover:bg-primary/80">
              Go to Login
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const user = session.user;
  const createdAt = new Date(user.createdAt ?? Date.now());

  return (
    <div className="flex min-h-svh w-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <IconShield className="size-5 text-primary" />
          <span className="text-sm font-medium">Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{user.email}</span>
          <Button variant="outline" size="xs" onClick={signout}>
            <IconLogout className="size-3.5" />
            Sign out
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col gap-6 p-6 md:p-10">
        <div>
          <h1 className="text-lg font-medium">Welcome, {user.name}</h1>
          <p className="text-xs text-muted-foreground">Here&apos;s an overview of your account.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Profile card */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <IconUser className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{user.name}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-2 text-xs">
                  <IconMail className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{user.email}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-2 text-xs">
                  <IconCalendar className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Joined:</span>
                  <span className="font-medium">
                    {createdAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status card */}
          <Card>
            <CardHeader>
              <CardTitle>Account Status</CardTitle>
              <CardDescription>Security & verification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Email verified</span>
                  <span
                    className={`font-medium ${user.emailVerified ? "text-green-600" : "text-destructive"}`}
                  >
                    {user.emailVerified ? "Yes" : "No"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Session active</span>
                  <span className="font-medium text-green-600">Yes</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sign out section */}
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Sign out</CardTitle>
            <CardDescription>
              End your current session and return to the login page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={signout}>
              <IconLogout className="size-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
