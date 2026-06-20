# QuestLab — Product Brief

## Project Overview

QuestLab is a web application that helps Dungeon Masters plan and run D&D campaigns. It combines purpose-built generation tools with AI assistance so DMs can either use structured tools directly or describe what they need in natural language and get usable campaign content back.

Core tools include (and will expand over time):

- Random map generator
- Character generator
- Loot generator
- Additional campaign-planning utilities as the product grows

The goal is to reduce prep time, spark creativity, and keep everything in one place for session planning and world-building.

## Target Audience

- **Primary:** Dungeon Masters running D&D (5e and adjacent systems), from first-time DMs to experienced GMs who want faster prep.
- **Secondary:** Players or co-DMs who contribute to world-building, NPCs, or one-shots.

Users are typically hobbyists who value speed, flexibility, and creative control—not a fully automated campaign, but a smart assistant and toolkit.

## Primary Benefits & Features

| Area | Benefit |
|------|---------|
| **Faster prep** | Generate maps, characters, loot, and other assets without starting from scratch. |
| **AI + tools** | Use generators as-is or refine results via prompts (tone, setting, constraints). |
| **Unified workspace** | One app for multiple DM workflows instead of scattered sites and spreadsheets. |
| **Creative control** | Outputs are starting points; DMs edit, save, and reuse content for their campaigns. |

**Near-term functional themes:**

- Authenticated users with saved campaigns or generated content (as features land)
- Modular tools that share patterns (inputs → generation → preview/export)
- AI layer that can drive or augment each tool based on DM prompts

## High-Level Tech & Architecture

| Layer | Stack |
|-------|--------|
| **Frontend** | React (Vite), Tailwind CSS, ShadCN UI |
| **API** | Node.js, Hono, tRPC |
| **Data** | Supabase (PostgreSQL), Drizzle ORM |
| **Auth** | Firebase Auth |
| **Package manager** | pnpm (monorepo: `ui`, `server`, `database-server`) |

Typical flow: React client → tRPC → Hono server → Postgres via Drizzle; Firebase handles sign-in. AI integrations will sit behind the API so keys and provider logic stay server-side.

---

*This brief is intentionally high-level. Detailed feature specs and implementation plans live in separate docs as tools are built.*
