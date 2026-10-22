# Booking password

Status: draft. Target: about 20 minutes to build.

## Problem

Anyone can cancel or move anyone's booking. There is no login, so the app cannot
tell who is acting: `actorId` is sent by the browser, and `ctx.userId` is always
null. The existing owner/admin check in `canManage` therefore protects nothing.

## Decision

Each booking gets a password, chosen when it is booked. Knowing the password is
the only proof of ownership.

- **Required for every new booking.**
- **Needed to cancel and to reschedule.**
- **Nobody skips it, admins included.** "Admin" is just a client-supplied
  `actorId`, so an admin bypass would be a hole.
- **No recovery.** If it is forgotten, the booking stays until it ends. The
  booking form shows a reminder: "Remember this password. You can't cancel or
  move this booking without it."
- **Old bookings (no password) stay open.** Anyone can still cancel or move
  them, because there is nothing to check against.

## Password rules

- 4 to 20 characters, any letters or numbers (a word or digits).
- Case-sensitive: "Blue7" is not "blue7".
- Stored hashed (never plain text) and never returned by any API or shown in
  the UI after booking.

## Changes

1. **Schema** (`packages/db/src/schema.ts`): add a nullable `password_hash` text
   column to `bookings`. Null means a legacy booking with no password. Then run
   `bun run generate` in `packages/db` and commit `migrations/` including
   `meta/`. Apply with `bun run db:apply` (and `db:apply:remote` before deploy).
2. **DB** (`packages/db/src/bookings.ts`): `insertBooking` accepts the hash. Add
   a way to read a booking's hash. Do not add it to the `Booking` type in
   `shared.ts`, which the browser imports and which must never carry it.
3. **Service** (`packages/services/src/bookings.ts`):
   - Add `password` to `createBookingInput`: trimmed or exact string, min 4,
     max 20 (limits as constants in `shared.ts` so the UI can show them).
   - Hash on create. Use Web Crypto (`crypto.subtle`, SHA-256 with a per-booking
     random salt), because this runs on Workers. A salted hash is enough here:
     the password is a short shared code, not an account credential.
   - `cancel` and `reschedule` take a `password`. If the booking has a hash and
     the password does not match, throw `ForbiddenError("Wrong password.")`.
     If there is no hash (legacy), skip the check.
   - Remove the `canManage` owner/admin check from both, since it cannot be
     trusted. Keep `requireMember(actorId)`.
   - Compare hashes in constant time.
4. **Router** (`apps/web/src/server/trpc/routers/bookings.ts`): add `password`
   to the `cancel` and `reschedule` inputs and pass it through. One service call
   each, as now.
5. **UI** (`apps/web/src/components/bookings/`, `routes/bookings.tsx`):
   - Booking form: required password field with the reminder text.
   - Cancel and reschedule: ask for the password (small dialog or inline
     field), show "Wrong password." on failure.
   - New files use kebab-case; do not copy the legacy PascalCase names.

## Tests (`packages/services/src/bookings.test.ts`)

- Create without a password, or shorter than 4 or longer than 20: rejected.
- Cancel and reschedule with the right password: succeed.
- Cancel and reschedule with a wrong password, or with a different case: 403.
- A different member or an admin with the wrong password: still 403.
- Legacy booking (null hash): cancel and reschedule work without a password.
- No API response contains the hash or the password.

## Out of scope

Password recovery or reset, admin override, lockout or rate limiting on wrong
guesses, real login, changing a booking's password after creation.

## Known limits

Without rate limiting, someone can guess short passwords. Acceptable for a small
team tool; revisit if it matters.
