# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Teamdesk: TanStack Start on Cloudflare Workers + D1, Bun/Turborepo monorepo. Layers: `apps/web` (UI, tRPC), `@repo/services` (rules, validation), `@repo/db` (Drizzle queries). Each has a README.

## Commands

- `bun run dev` migrates and seeds the local DB first. No Cloudflare account or env vars needed.
- `bun test` runs everything. One file: `bun test packages/services/src/bookings.test.ts`. By name: `bun test -t "pattern"`.
- `bun run check` is lint + typecheck. `bun run fix` formats; the pre-commit hook runs it.
- After editing `packages/db/src/schema.ts`, run `bun run generate` in `packages/db` and commit `migrations/` including `meta/`. Why: drizzle diffs against the snapshot in `meta/`; without it the next generate recreates the tables.
- Migrations are applied by wrangler (`bun run db:apply[:remote]`), not drizzle-kit. Why: D1 is the real target and `wrangler.jsonc` owns `migrations_dir`.
- `worker-configuration.d.ts` (the `Env` type) is gitignored and generated on `bun install`. Typecheck fails on a fresh checkout until `bun run cf-typegen` has run.

## Rules

- **Return plain JSON from every tRPC procedure** (ISO strings, string ids, never `Date`). Why: there is no transformer, and SSR uses an in-process link, so a `Date` stays a `Date` on first load and becomes a string after client navigation.
- **Browser code imports only `@repo/db/shared`.** Why: every other entry imports drizzle and would bloat or break the client bundle. UI-visible types and limits go in `src/shared.ts`.
- **No barrel files.** A new table or service gets its own `src/<name>.ts` plus an `exports` line in that package's `package.json`, and a service also needs a line in `apps/web/src/server/trpc/context.ts`. Why: imports of the missing export fail with no obvious cause.
- **Validation and permissions live in services, not in `@repo/db` or routers.** Services export their zod schema; routers pass it to `.input()` and make one service call. Why: services parse again so non-tRPC callers are also validated, and `@repo/db` is deliberately dumb.
- **Fail with `ServiceError` subclasses** (`NotFoundError`, `ValidationError`, `ConflictError`, `ForbiddenError`). Why: `init.ts` maps them to 404/400/409/403; a plain `Error` becomes a 500 whose message is hidden in production.
- **Use `ctx.services` in procedures, never `ctx.env`.** Why: the SSR path doesn't provide `env`; the D1 binding is read only in `context.ts`.
- **Don't add `cors()` to `/api/trpc/*`.** Why: JSON POSTs are CSRF-safe only because cross-site ones need a preflight that nothing answers. `csrf()` covers form posts.
- **There is no auth.** `ctx.userId` is always null, so `protectedProcedure` always 401s. Mutations take `actorId` in their input and services check it with `requireMember` / `requireAdmin`. Why: using `protectedProcedure` for team features makes them unreachable.
- **Time is UTC ISO.** Slots are half-open `[startsAt, endsAt)` and the daily booking limit counts by UTC day. Format dates in the UI with `lib/datetime.ts`, never `toLocaleString()`. Why: locale/timezone differences cause hydration mismatches.
- **Don't edit generated or vendored files:** `components/ui/**` and `hooks/use-mobile.ts` (shadcn; Biome ignores them and `ultracite fix` corrupts them) and `routeTree.gen.ts` (run `bun run generate-routes` in `apps/web`).
- **New component files use kebab-case.** `components/bookings/` is legacy PascalCase with the rule turned off; don't copy it.
- **Import app files with the `#/*` alias** (`apps/web/src/*`).

## Deployment

The live app is https://teamdesk.zhaolingyun1010.workers.dev, deployed from `apps/web` with `bun run deploy`. The real D1 `database_id` is in `wrangler.jsonc`; the string `"local"` it replaced was only a placeholder. A schema change needs `bun run db:apply:remote` before deploying. `db:seed:remote` is safe to re-run.
