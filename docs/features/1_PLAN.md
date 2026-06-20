# NPC Generator — Technical Plan

## Context

Add a new **NPC generator** page to QuestLab. Generation runs server-side via the **OpenAI API**: produce an NPC **name** and **description** with a chat/completions call, then produce a portrait using the **`gpt-image-1`** image model. The UI follows the existing tool pattern (inputs → generate → preview). No database persistence in this iteration—results are returned to the client for display/copy only.

---

## Files to Create

| File | Purpose |
|------|---------|
| `server/src/lib/openai.ts` | Lazy OpenAI client factory using `OPENAI_API_KEY` from env |
| `server/src/schema/npc.ts` | Zod input/output schemas for NPC generation |
| `server/src/services/npc-generator.ts` | Orchestrates text + image generation |
| `server/src/trpc/routers/npc.ts` | tRPC mutation exposing generation |
| `ui/src/pages/NpcGenerator.tsx` | NPC generator page |

## Files to Modify

| File | Change |
|------|--------|
| `server/package.json` | Add `openai` SDK via `pnpm add openai` in `server/` |
| `server/.env.example` | Document `OPENAI_API_KEY` (and optional `OPENAI_TEXT_MODEL`) |
| `server/src/lib/env.ts` | Add `getOpenAIApiKey()` / optional text model getter |
| `server/src/trpc/router.ts` | Register `npc: npcRouter` on `appRouter` |
| `ui/src/App.tsx` | Add route `/npc-generator` → `<NpcGenerator />` |
| `ui/src/components/appSidebar.tsx` | Add sidebar nav item (e.g. Users icon, label "NPC Generator") |

## ShadCN Components to Add (UI)

Run in `ui/` as needed:

- `textarea` — user prompt input
- `badge` — optional tags for loading/error states (if not using inline text only)

Existing `button`, `card`, `input`, `label`, `skeleton` are sufficient for layout and loading placeholders.

---

## Environment

Add to `server/.env` (user-managed; not committed):

```
OPENAI_API_KEY=sk-...
OPENAI_TEXT_MODEL=gpt-4o-mini   # optional; default in code if unset
```

No new frontend env vars. OpenAI calls stay behind the API per product architecture.

---

## Types & Schemas (`server/src/schema/npc.ts`)

**Input** (`npcGenerateInputSchema`):

- `prompt` (string, required, min 1, max ~2000) — DM's natural-language request (e.g. role, setting, personality)
- `setting` (string, optional) — campaign/world context
- `tone` (string, optional) — e.g. "grim", "comedic", "heroic"

**Output** (`npcGenerateOutputSchema`):

- `name` (string)
- `description` (string) — multi-paragraph NPC write-up suitable for session prep
- `imageBase64` (string) — base64-encoded PNG from `gpt-image-1` (no permanent storage)
- `imageMediaType` (literal `"image/png"`)

No Drizzle tables or migrations for v1.

---

## Generation Algorithm (`server/src/services/npc-generator.ts`)

Step-by-step for `generateNpc(input)`:

1. **Build text system prompt** — Instruct the model to act as a D&D DM assistant. Require JSON output with exactly `name` and `description`. Description should cover appearance, personality, motivation, and a hook the DM can use at the table. Honor `prompt`, `setting`, and `tone` when provided.

2. **Call OpenAI Chat Completions** — Use the SDK with `response_format: { type: "json_object" }` (or equivalent structured parsing). Model: `getEnv('OPENAI_TEXT_MODEL') ?? 'gpt-4o-mini'`. Parse and validate response with `npcGenerateOutputSchema` pick for `{ name, description }`. On parse failure or missing fields, throw a tRPC `INTERNAL_SERVER_ERROR` with a safe message.

3. **Build image prompt** — Derive a concise portrait prompt from the generated `name` and `description` (e.g. "Fantasy RPG character portrait, bust shot, …"). Keep it suitable for `gpt-image-1` and D&D tone; avoid explicit gore.

4. **Call OpenAI Images API** — `images.generate` with:
   - `model: "gpt-image-1"`
   - `prompt`: image prompt from step 3
   - `size`: `"1024x1024"` (or `"512x512"` if cost/latency is a concern—pick one and document in code)
   - Request `b64_json` in the response format supported by the SDK

5. **Return combined result** — `{ name, description, imageBase64, imageMediaType: "image/png" }`.

6. **Error handling** — Map OpenAI rate limits / auth errors to appropriate tRPC codes (`TOO_MANY_REQUESTS`, `INTERNAL_SERVER_ERROR`). Do not leak API key or raw provider errors to the client.

---

## API Layer (`server/src/trpc/routers/npc.ts`)

- **`npc.generate`** — `protectedProcedure` (requires authenticated user to limit OpenAI abuse/cost; matches existing auth-gated data access pattern in `server/src/trpc/init.ts`).
- Input: `npcGenerateInputSchema`
- Output: full `npcGenerateOutputSchema`
- Delegates to `generateNpc(input)` in the service module.

Register in `server/src/trpc/router.ts`:

```ts
npc: npcRouter,
```

---

## UI (`ui/src/pages/NpcGenerator.tsx`)

Layout (match `Page1.tsx` / `Home.tsx` container patterns):

1. **Header** — Title "NPC Generator", short subtitle.
2. **Input form** — `prompt` textarea (required), optional `setting` and `tone` text inputs, "Generate" button.
3. **Loading state** — Disable form; show skeleton or spinner while mutation runs (text + image can take several seconds).
4. **Result panel** (Card) — After success:
   - NPC name as heading
   - `<img src={`data:${imageMediaType};base64,${imageBase64}`} />` for portrait
   - Description in prose block
   - "Copy description" button (clipboard API)
   - "Generate again" reuses current form values
5. **Error state** — Toast or inline alert from tRPC error message.

Wire mutation via existing tRPC React Query setup in `ui/src/lib/trpc.ts`:

```ts
trpc.npc.generate.useMutation()
```

---

## Routing & Navigation

- Route path: `/npc-generator`
- Import and register in `ui/src/App.tsx` alongside existing routes
- Add sidebar link in `ui/src/components/appSidebar.tsx` under Navigation group

---

## Implementation Phases

### Phase 1 — Server foundation (sequential)

1. Add `openai` dependency and env helpers
2. Define Zod schemas in `server/src/schema/npc.ts`
3. Implement `server/src/lib/openai.ts` and `server/src/services/npc-generator.ts`
4. Add `npc` tRPC router and register on `appRouter`

### Phase 2A — UI (parallel with 2B testing)

1. Add ShadCN components if missing
2. Build `NpcGenerator.tsx` with form, mutation, and result display
3. Register route and sidebar entry

### Phase 2B — Manual verification (parallel with 2A)

1. Set `OPENAI_API_KEY` in local `server/.env`
2. Sign in, open `/npc-generator`, submit a prompt
3. Confirm name, description, and `gpt-image-1` portrait render correctly
4. Confirm unauthenticated requests to `npc.generate` return `UNAUTHORIZED`

---

## Out of Scope (v1)

- Saving NPCs to Postgres / user library
- Campaign association
- Streaming partial text responses
- Image upload or editing
- REST endpoints (tRPC-only unless image payloads force a separate download route later)
