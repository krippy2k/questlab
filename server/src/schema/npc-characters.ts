import { index, text, timestamp } from 'drizzle-orm/pg-core';
import { appSchema } from './users';
import { worlds } from './worlds';

export const npcCharacters = appSchema.table(
  'npc_characters',
  {
    id: text('id').primaryKey(),
    world_id: text('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull(),
    image_base64: text('image_base64').notNull(),
    image_media_type: text('image_media_type').notNull().default('image/png'),
    generation_prompt: text('generation_prompt'),
    generation_setting: text('generation_setting'),
    generation_tone: text('generation_tone'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    worldIdIdx: index('npc_characters_world_id_idx').on(table.world_id),
  })
);

export type NpcCharacter = typeof npcCharacters.$inferSelect;
export type NewNpcCharacter = typeof npcCharacters.$inferInsert;
