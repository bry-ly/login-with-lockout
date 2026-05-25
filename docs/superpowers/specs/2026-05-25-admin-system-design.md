# Admin System Design

## Overview
Admin panel for user management and lockout analytics, built on top of the existing better-auth + progressive lockout system.

## Architecture

```
/admin/login      → Server action: signIn + role check (role === "admin")
/admin/dashboard  → User management table + lockout analytics
proxy.ts          → Protects /admin/* routes, validates admin role
```

## Better Auth Admin Plugin

- Add `admin()` plugin to `lib/auth.ts` (adds `role`, `banned`, `banReason`, `banExpires` fields to User)
- Add `adminClient()` to `lib/auth-client.ts`
- Default role: `"user"`, admin role: `"admin"`
- Re-run `npx @better-auth/cli@latest generate` to update Prisma schema

## Admin Login (`/admin/login`)

- Reuses same better-auth email/password flow
- Server action signs in, then checks `session.user.role === "admin"`
- If not admin: sign out server-side, return "Not authorized" error
- If admin: redirect to `/admin/dashboard`

## Route Protection (`proxy.ts`)

- Extend matcher to include `/admin/:path*`
- After session validation, verify `session.user.role === "admin"`
- Non-admins redirected to `/login`
- Existing `/dashboard` protection unchanged

## Admin Dashboard (`/admin/dashboard`)

### User Management Table
- Search by email/name via `auth.api.listUsers` (server action)
- Columns: Name, Email, Role, Lockout Strikes, Locked Until, Actions (Unlock button)
- Pagination via listUsers offset/limit
- Unlock: server action deletes row from `loginLockout` table by email, then refreshes user list

### Lockout Analytics
- Total currently locked accounts (`loginLockout` count where lockedUntil > now)
- Top 5 users by strike count
- Total failed attempts (sum of all strikes)

### Layout
- Client component with tab-based navigation (Users / Analytics)
- Consistent with existing shadcn Card/Button/Input UI patterns
- Responsive: single column on mobile, two-column on desktop

## Seed Script (`prisma/seed-admin.ts`)

- Usage: `pnpm db:seed admin <email>`
- Checks if user exists via Prisma `user.findUnique`
- Sets `role: "admin"` via `auth.api.setRole`
- Error message if email is not registered

## Data Flow

```
Admin login POST
  → server action checks lockout → signInEmail → check role
  → success + role=admin → set session → redirect /admin/dashboard
  → success + role=user → sign out → return error

Admin dashboard load
  → proxy.ts validates session + role → page renders
  → listUsers server action fetches users
  → lockoutStats server action queries loginLockout table
  → unlock action deletes loginLockout row
```
