# Worlds — Technical Plan

## Context

Introduce **Worlds** as the top-level container for a complete gaming ecosystem in QuestLab. A user creates a World with a **name** and **description**, then creates content **within** that World—starting with the existing **NPC character generator**. NPC characters are **tied to a specific world** and are **not shared with other worlds**. The user **SHOULD be able to copy a character from one world to another**; the copy is a **separate character that can be edited separately**.

This builds on the stateless NPC generator from `1_PLAN.md` by adding Postgres persistence, world scoping, and world-scoped UI navigation.

---

## Data Layer (Phase 1 — sequential, blocks API/UI)

### New Drizzle tables

**`server/src/schema/worlds.ts`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | `crypto.randomUUID()` at insert |
| `user_id` | `text` FK → `app.users.id` | Owner; all access checks use this |
| `name` | `text` NOT NULL | Required; trim; max ~200 chars (enforce in Zod) |
| `description` | `text` | Optional; max ~5000 chars |
| `created_at` | `timestamp` | `defaultNow()` |
| `updated_at` | `timestamp` | `defaultNow()`; bump on update |

Index on `user_id` for list queries.

**`server/src/schema/npc-characters.ts`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | `crypto.randomUUID()` |
| `world_id` | `text` FK → `app.worlds.id` ON DELETE CASCADE | Scopes character to one world |
| `name` | `text` NOT NULL | From generation or user edit |
| `description` | `text` NOT NULL | Session-prep prose |
| `image_base64` | `text` NOT NULL | PNG as base64 (matches current generator output) |
| `image_media_type` | `text` NOT NULL | Default `'image/png'` |
| `generation_prompt` | `text` | Optional; original user prompt for reference |
| `generation_setting` | `text` | Optional |
| `generation_tone` | `text` | Optional |
| `created_at` | `timestamp` | `defaultNow()` |
| `updated_at` | `timestamp` | `defaultNow()` |

Index on `world_id` for per-world NPC lists.

No `source_npc_id` or cross-world FK on copy—the copy is an independent row.

### Schema wiring

| File | Change |
|------|--------|
| `server/src/schema/worlds.ts` | **Create** — `worlds` table in `appSchema` |
| `server/src/schema/npc-characters.ts` | **Create** — `npc_characters` table in `appSchema` |
| `server/src/schema/zod.ts` | **Modify** — add `worldSelectSchema`, `worldInsertSchema`, `worldUpdateSchema`, `npcCharacterSelectSchema`, `npcCharacterInsertSchema`, `npcCharacterUpdateSchema` (timestamps → ISO strings, same pattern as `userSelectSchema`) |
| `server/src/schema/npc.ts` | **Keep** — generation-only Zod schemas (`npcGenerateInputSchema`, `npcGenerateOutputSchema`); no Drizzle here |
| `server/src/lib/db.ts` | **Modify** — import combined schema (`users`, `worlds`, `npc_characters`) instead of `users` only |

Run `cd server && pnpm db:push` after schema changes.

### Access helper

**`server/src/lib/world-access.ts`** (create)

- `getOwnedWorld(db, worldId, userId)` — select world where `id = worldId AND user_id = userId`; throw `NOT_FOUND` if missing (do not leak existence of other users' worlds).
- Reuse in all world- and NPC-scoped procedures.

---

## API Layer (Phase 2A)

### World router — `server/src/trpc/routers/world.ts`

All procedures use `protectedProcedure` (authenticated Firebase user, including anonymous if allowed).

| Procedure | Type | Input | Behavior |
|-----------|------|-------|----------|
| `world.list` | query | none | Select all worlds for `ctx.user.id`, order `updated_at desc` |
| `world.get` | query | `{ id: string }` | `getOwnedWorld`; return `worldSelectSchema` |
| `world.create` | mutation | `{ name, description? }` | Insert row; return created world |
| `world.update` | mutation | `{ id, name?, description? }` | `getOwnedWorld`; patch fields; set `updated_at` |
| `world.delete` | mutation | `{ id }` | `getOwnedWorld`; delete (cascades NPCs) |

### NPC character router — extend `server/src/trpc/routers/npc.ts`

Keep existing `npc.generate` (`signedInProcedure`, stateless OpenAI call). Add persistence procedures:

| Procedure | Type | Input | Behavior |
|-----------|------|-------|----------|
| `npc.listByWorld` | query | `{ worldId }` | `getOwnedWorld`; select NPCs where `world_id = worldId`, order `created_at desc` |
| `npc.get` | query | `{ id }` | Join/load NPC; verify parent world owned by user |
| `npc.create` | mutation | `{ worldId, ...npcGenerateOutputSchema fields, generationPrompt?, generationSetting?, generationTone? }` | `getOwnedWorld`; insert `npc_characters` row |
| `npc.update` | mutation | `{ id, name?, description? }` | Verify ownership via world; update text fields only |
| `npc.delete` | mutation | `{ id }` | Verify ownership; delete row |
| `npc.copyToWorld` | mutation | `{ npcId, targetWorldId }` | See algorithm below |

Register `worldRouter` in `server/src/trpc/router.ts`:

```ts
world: worldRouter,
```

(`npc` router already registered.)

### Copy-to-world algorithm (`npc.copyToWorld`)

1. Load source NPC by `npcId` with its `world_id`.
2. Call `getOwnedWorld` for source world and `userId` — reject if not owner.
3. Call `getOwnedWorld` for `targetWorldId` and `userId` — reject if not owner.
4. If `source.world_id === targetWorldId`, throw `BAD_REQUEST` ("Already in this world").
5. Insert new `npc_characters` row:
   - New `id` (UUID)
   - `world_id` = `targetWorldId`
   - Copy `name`, `description`, `image_base64`, `image_media_type`, `generation_prompt`, `generation_setting`, `generation_tone`
   - Fresh `created_at` / `updated_at`
6. Return new NPC via `npcCharacterSelectSchema`.

Edits to the copy do not affect the original (separate rows).

### World-aware generation flow (client-orchestrated)

No new server mutation required. Recommended UI flow:

1. Call `npc.generate` with `setting` pre-filled from the parent world's `description` (user can override).
2. On success, user clicks **Save to world** → `npc.create` with generated fields + form metadata.
3. Alternatively **Generate & save** single action that chains both calls.

---

## UI Layer (Phase 2B — parallel with 2A)

### Routing (`ui/src/App.tsx`)

| Path | Page | Purpose |
|------|------|---------|
| `/worlds` | `WorldsList` | List user's worlds; create new world |
| `/worlds/:worldId` | `WorldDetail` | World name/description; hub for in-world tools |
| `/worlds/:worldId/npcs` | `WorldNpcGenerator` | NPC generator scoped to this world |
| `/worlds/:worldId/npcs/:npcId` | `WorldNpcDetail` | View/edit saved NPC; copy to another world |

Remove or redirect standalone `/npc-generator` → `/worlds` (NPC generation only makes sense inside a world per requirements). Update `appSidebar.tsx`: replace "NPC Generator" nav with "Worlds" (`Globe` or `Map` icon).

### New pages

**`ui/src/pages/WorldsList.tsx`**

- Query `trpc.world.list`
- Empty state with CTA to create first world
- Card/list per world (name, description excerpt, updated date)
- Create form (inline or dialog): name (required), description (textarea, optional) → `world.create` → navigate to `/worlds/:id`

**`ui/src/pages/WorldDetail.tsx`**

- Query `trpc.world.get` by route param
- Display/edit name and description (`world.update`)
- Section: **NPCs** — `trpc.npc.listByWorld` summary list with links to detail
- Primary CTA: **Create NPC** → `/worlds/:worldId/npcs`
- Delete world action (confirm dialog) → `world.delete` → `/worlds`

**`ui/src/pages/WorldNpcGenerator.tsx`**

- Refactor from `NpcGenerator.tsx` (reuse form/result UI)
- Load world via `trpc.world.get`; 404 if not found
- Pre-fill `setting` input from `world.description`
- After `npc.generate` succeeds, show **Save to world** (and keep Copy description / Generate again)
- **Save to world** → `npc.create` → navigate to `/worlds/:worldId/npcs/:npcId`
- Breadcrumb/back link to world detail

**`ui/src/pages/WorldNpcDetail.tsx`**

- Query `npc.get`
- Display portrait, name, description (editable fields + Save → `npc.update`)
- **Copy to world** — dialog with `world.list` dropdown (exclude current world) → `npc.copyToWorld` → navigate to copied NPC in target world
- Delete NPC → `npc.delete` → back to world detail

### ShadCN components to add (if missing)

Run in `ui/` as needed:

- `dialog` — create world, copy NPC, delete confirmations
- `select` — target world picker for copy

Existing `button`, `card`, `input`, `label`, `textarea`, `skeleton` suffice elsewhere.

### Navigation (`ui/src/components/appSidebar.tsx`)

- Replace NPC Generator link with **Worlds** → `/worlds`
- `isActive` for world routes: prefix match on `/worlds`

---

## Files Summary

### Create

| File | Purpose |
|------|---------|
| `server/src/schema/worlds.ts` | `worlds` Drizzle table |
| `server/src/schema/npc-characters.ts` | `npc_characters` Drizzle table |
| `server/src/lib/world-access.ts` | Ownership verification helper |
| `server/src/trpc/routers/world.ts` | World CRUD tRPC router |
| `ui/src/pages/WorldsList.tsx` | Worlds index + create |
| `ui/src/pages/WorldDetail.tsx` | World hub |
| `ui/src/pages/WorldNpcGenerator.tsx` | World-scoped NPC generator + save |
| `ui/src/pages/WorldNpcDetail.tsx` | View/edit/copy/delete saved NPC |

### Modify

| File | Change |
|------|--------|
| `server/src/schema/zod.ts` | World + NPC character Zod schemas |
| `server/src/lib/db.ts` | Register new tables in Drizzle schema |
| `server/src/trpc/routers/npc.ts` | Add list/get/create/update/delete/copy procedures |
| `server/src/trpc/router.ts` | Register `worldRouter` |
| `ui/src/App.tsx` | World routes; remove/redirect `/npc-generator` |
| `ui/src/components/appSidebar.tsx` | Worlds nav item |
| `ui/src/pages/NpcGenerator.tsx` | Delete or reduce to shared subcomponents imported by `WorldNpcGenerator` |

---

## Implementation Phases

### Phase 1 — Data layer (sequential)

1. Create `worlds` and `npc_characters` Drizzle schemas
2. Add Zod select/insert/update schemas in `zod.ts`
3. Update `db.ts` schema import
4. Add `world-access.ts` helper
5. `pnpm db:push`

### Phase 2A — API (parallel with 2B)

1. Implement `worldRouter` CRUD
2. Extend `npcRouter` with persistence + `copyToWorld`
3. Register router

### Phase 2B — UI (parallel with 2A)

1. Add ShadCN `dialog`, `select` if needed
2. Build Worlds list, detail, world-scoped NPC generator, NPC detail pages
3. Update routes and sidebar; retire standalone `/npc-generator`

---

## Out of Scope (this iteration)

- Additional in-world tools beyond NPC generator (maps, loot, etc.)—World detail UI should leave room for future tool links
- Shared/collaborative worlds (multi-user ownership)
- Image re-generation or external object storage (images stay as base64 in Postgres)
- Streaming generation
- Copying entire worlds (only individual NPC copy is required)
