CREATE TABLE IF NOT EXISTS "app"."worlds" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "app"."users"("id"),
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "worlds_user_id_idx" ON "app"."worlds" ("user_id");

CREATE TABLE IF NOT EXISTS "app"."npc_characters" (
  "id" text PRIMARY KEY NOT NULL,
  "world_id" text NOT NULL REFERENCES "app"."worlds"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "image_base64" text NOT NULL,
  "image_media_type" text DEFAULT 'image/png' NOT NULL,
  "generation_prompt" text,
  "generation_setting" text,
  "generation_tone" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "npc_characters_world_id_idx" ON "app"."npc_characters" ("world_id");
