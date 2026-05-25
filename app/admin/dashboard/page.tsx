"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { getDashboardData, unlockUser, type DashboardData } from "./actions";
import { MAX_ATTEMPTS } from "@/lib/rate-limit-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconLogout,
  IconSearch,
  IconShield,
  IconLock,
  IconLockOpen,
  IconUsers,
  IconAlertTriangle,
  IconX,
} from "@tabler/icons-react";

type Tab = "users" | "analytics";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [tab, setTab] = useState<Tab>("users");
  const [data, setData] = useState<DashboardData | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const result = await getDashboardData();
      if (cancelled) return;
      setData(result);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: { onSuccess: () => router.push("/login") },
    });
  };

  const handleUnlock = async (email: string) => {
    setData(await unlockUser(email));
  };

  const filteredUsers = (data?.users ?? []).filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase())
  );

  if (isPending) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  const stats = data?.stats ?? { currentlyLocked: 0, topUsers: [], totalStrikes: 0 };

  return (
    <div className="flex min-h-svh flex-col p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconShield className="size-6 text-destructive" />
          <div>
            <h1 className="text-lg font-medium">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">Signed in as {session?.user?.email}</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleSignOut}>
          <IconLogout className="size-4" />
          Sign out
        </Button>
      </header>

      <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => setTab("users")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "users" ? "bg-background shadow-xs" : "hover:text-foreground"
          }`}
        >
          <IconUsers className="size-3.5" />
          Users
        </button>
        <button
          onClick={() => setTab("analytics")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "analytics" ? "bg-background shadow-xs" : "hover:text-foreground"
          }`}
        >
          <IconAlertTriangle className="size-3.5" />
          Analytics
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-6" />
        </div>
      ) : tab === "users" ? (
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Search and manage registered users</CardDescription>
            <div className="relative mt-2">
              <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        user.role === "admin"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {user.strikes > 0 ? (
                        <span className={user.strikes >= MAX_ATTEMPTS ? "text-destructive font-medium" : ""}>
                          {user.strikes} / {MAX_ATTEMPTS}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.lockedUntil ? (
                        <span className="flex items-center gap-1 text-[11px] text-destructive">
                          <IconLock className="size-3" />
                          Locked
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-green-600">
                          <IconLockOpen className="size-3" />
                          Active
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.lockedUntil && (
                        <Button variant="ghost" size="sm" onClick={() => handleUnlock(user.email)} className="text-xs">
                          <IconX className="size-3.5" />
                          Unlock
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Currently Locked</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-destructive">{stats.currentlyLocked}</p>
              <p className="text-xs text-muted-foreground">accounts temporarily locked</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Strikes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{stats.totalStrikes}</p>
              <p className="text-xs text-muted-foreground">failed attempts across all users</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tracked Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{stats.topUsers.length}</p>
              <p className="text-xs text-muted-foreground">users with lockout history</p>
            </CardContent>
          </Card>

          {stats.topUsers.length > 0 && (
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="text-sm">Top Lockout Users</CardTitle>
                <CardDescription>Users with the most failed attempts</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Strikes</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.topUsers.map((u) => (
                      <TableRow key={u.email}>
                        <TableCell className="text-xs">{u.email}</TableCell>
                        <TableCell className="text-xs tabular-nums font-medium">{u.strikes}</TableCell>
                        <TableCell>
                          {u.lockedUntil && new Date(u.lockedUntil) > new Date() ? (
                            <span className="flex items-center gap-1 text-[11px] text-destructive">
                              <IconLock className="size-3" />
                              Locked
                            </span>
                          ) : (
                            <span className="text-[11px] text-green-600">Active</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
