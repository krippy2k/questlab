# NPC Generator — Code Review

Reviewed against [1_PLAN.md](./1_PLAN.md). Typecheck passes for both `server/` and `ui/`.

---

## Summary

The feature is **correctly implemented** and closely follows the plan. Server orchestration (text → portrait), Zod schemas, tRPC wiring, env helpers, routing, and UI layout all match the spec. No snake_case / camelCase mismatches were found—the stack uses camelCase end-to-end (`imageBase64`, `imageMediaType`, etc.).

A few gaps around **cost/abuse control**, **missing-config error handling**, and **UI stale-state** are worth addressing before treating this as production-ready.

---

## Plan Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| `server/src/lib/openai.ts` — lazy client | ✅ | Singleton via `getOpenAIClient()` |
| `server/src/schema/npc.ts` | ✅ | Input/output schemas + `npcTextOutputSchema` pick |
| `server/src/services/npc-generator.ts` | ✅ | Text → image pipeline, error mapping |
| `server/src/trpc/routers/npc.ts` | ✅ | `protectedProcedure`, input/output validation |
| Register `npc` on `appRouter` | ✅ | `server/src/trpc/router.ts` |
| `ui/src/pages/NpcGenerator.tsx` | ✅ | Form, loading skeleton, result card, copy/retry |
| Route `/npc-generator` | ✅ | `ui/src/App.tsx` |
| Sidebar nav (Users icon) | ✅ | `ui/src/components/appSidebar.tsx` |
| `openai` dependency | ✅ | `server/package.json` |
| `.env.example` docs | ✅ | `OPENAI_API_KEY`, optional `OPENAI_TEXT_MODEL` |
| Env getters | ✅ | `getOpenAIApiKey()`, `getOpenAITextModel()` |
| ShadCN `textarea` | ✅ | Present in `ui/src/components/ui/textarea.tsx` |
| ShadCN `badge` | ⏭️ Skipped | Plan marked optional; inline alert used instead |
| No DB persistence | ✅ | No migrations or Drizzle tables |
| Chat JSON + `gpt-image-1` portrait | ✅ | `response_format: json_object`, `size: 1024x1024` |
| Manual auth verification | ⚠️ Partial | See finding #1 |

---

## Findings

### 1. Medium — Anonymous users can consume OpenAI quota

**Plan intent:** `protectedProcedure` to “limit OpenAI abuse/cost” and manual test “unauthenticated requests return `UNAUTHORIZED`.”

**Actual behavior:** Any Firebase user with a valid Bearer token passes `protectedProcedure`, including **anonymous** users when `ALLOW_ANONYMOUS_USERS` is enabled (the app default). Only requests with no/invalid token get `UNAUTHORIZED`.

`resolveOptionalUserForRequest` upserts anonymous users into `app.users`; `requireUser` middleware only checks `ctx.user !== null`.

**Impact:** OpenAI cost/abuse is not limited to signed-in (email) accounts as the plan implies.

**Suggestion:** If cost control is important, add middleware or a check in the router/service that rejects users without an email (or add a dedicated `requireNonAnonymous` procedure), matching how `FORBIDDEN_ANONYMOUS` is enforced elsewhere in auth.

---

### 2. Medium — Missing `OPENAI_API_KEY` may leak env var name to client

`getOpenAIApiKey()` calls `getRequiredEnv('OPENAI_API_KEY')`, which throws a plain `Error`:

```ts
throw new Error(`Required environment variable ${key} is not set`);
```

This is **not** caught by `mapOpenAIError()` in the service. On first generation attempt without the key configured, tRPC may surface the raw message to the client—unlike the sanitized OpenAI API errors elsewhere.

**Suggestion:** Catch config errors in `generateNpc` / `getOpenAIClient` and throw a `TRPCError` with a generic message (e.g. “NPC generation is temporarily unavailable.”), or validate the key at router startup.

---

### 3. Low — Stale result shown after a failed re-generation

`generateMutation.data` retains the **last successful** result. If the user clicks “Generate again” and the second call fails, the UI shows:

- The inline error alert (new failure), **and**
- The previous NPC result card (`result && !isGenerating`).

**Suggestion:** Clear result on new submit (`generateMutation.reset()` in `handleSubmit` / `handleGenerateAgain`, as done in `Settings.tsx`), or hide the result card when `generateMutation.isError`.

---

### 4. Low — Whitespace-only prompts accepted by API

The UI trims and disables submit for empty prompts, but the server schema only checks `min(1)` without `.trim()`. A direct tRPC call with `{ prompt: "   " }` would pass validation and invoke OpenAI.

**Suggestion:** Add `.trim().min(1)` to `prompt` in `npcGenerateInputSchema`, or trim in `generateNpc` before calling OpenAI.

---

### 5. Low — Large base64 payloads over tRPC JSON

Returning a 1024×1024 PNG as base64 in the mutation response (~1–2 MB JSON) is consistent with the plan but may hit proxy/body limits or slow responses on slow networks. No issue for local dev; worth monitoring in production.

**Out of scope for v1** per plan; note for future if Cloudflare Workers or mobile clients struggle.

---

### 6. Info — Redundant validation / parsing

- Input is validated by tRPC `.input(npcGenerateInputSchema)` and again in `generateNpc()` via `npcGenerateInputSchema.parse(rawInput)`.
- Output is built by typed code then re-parsed with `npcGenerateOutputSchema.parse(result)` in the router.

Harmless but slightly redundant. Output re-parse is a reasonable safety net; input re-parse in the service could be dropped.

---

### 7. Info — Minor style nits

- `getOpenAITextModel()`: `getEnv('OPENAI_TEXT_MODEL', 'gpt-4o-mini') ?? 'gpt-4o-mini'` — the `??` fallback is redundant because `getEnv` already supplies a default.
- `handleSubmit` and `handleGenerateAgain` duplicate the same `mutate({ ... })` payload; could be a one-liner helper, but file size (~185 lines) is fine.
- Lucide icon class order varies (`h-4 w-4` vs `w-4 h-4` elsewhere); cosmetic only.

---

## Data Alignment Check

| Layer | Field names | Verdict |
|-------|-------------|---------|
| Zod input | `prompt`, `setting`, `tone` | ✅ camelCase |
| Zod output | `name`, `description`, `imageBase64`, `imageMediaType` | ✅ camelCase |
| OpenAI text JSON | `"name"`, `"description"` per system prompt | ✅ Matches `npcTextOutputSchema` |
| OpenAI image API | `data[0].b64_json` | ✅ Correct SDK path; comment documents `gpt-image-1` behavior |
| UI data URL | `` `data:${result.imageMediaType};base64,${result.imageBase64}` `` | ✅ Matches plan |

No `{ data: { ... } }` nesting issues observed.

---

## What Was Done Well

- Clean separation: schema → service → router → page.
- OpenAI errors mapped to safe tRPC codes (`TOO_MANY_REQUESTS`, generic `INTERNAL_SERVER_ERROR`); no API key or raw provider errors in mapped paths.
- Image prompt builder avoids gore and keeps D&D-appropriate framing.
- UI follows existing patterns (`container mx-auto p-6`, Card layout, inline destructive alert like Settings).
- Lazy OpenAI client avoids startup failure when key is unset (though first request still fails—see finding #2).
- TypeScript compiles cleanly; tRPC types flow to `trpc.npc.generate.useMutation()` via `AppRouter`.

---

## Recommended Follow-ups

1. **Decide anonymous-user policy** for paid API features (reject anonymous vs. accept as “authenticated”).
2. **Wrap missing API key** in a safe `TRPCError`.
3. **Reset mutation state** on new generation to avoid stale results on failure.
4. **Trim prompt** on the server schema.
5. **Manual smoke test** (Phase 2B): signed-in user, `/npc-generator`, confirm portrait renders; no-token request returns `UNAUTHORIZED`.

No automated tests were added; the plan only specified manual verification, which is acceptable for v1.
