import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { npcCharacters } from './npc-characters';
import { users } from './users';
import { worlds } from './worlds';

/** User row shape for tRPC/JSON responses (timestamps as ISO strings). */
export const userSelectSchema = createSelectSchema(users).transform((row) => ({
  ...row,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
}));

const insertBase = createInsertSchema(users);
export const userInsertSchema = insertBase;

export const userUpdateSchema = insertBase.pick({ display_name: true }).partial();

export type UserSelect = z.infer<typeof userSelectSchema>;
export type UserInsert = z.infer<typeof userInsertSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;

export const worldSelectSchema = createSelectSchema(worlds).transform((row) => ({
  ...row,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
}));

const worldInsertBase = createInsertSchema(worlds, {
  name: (schema) => schema.name.trim().min(1).max(200),
  description: (schema) => schema.description.max(5000).optional(),
});

export const worldCreateSchema = worldInsertBase.pick({ name: true, description: true });

export const worldUpdateSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(5000).nullable().optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'At least one field must be provided',
  });

export type WorldSelect = z.infer<typeof worldSelectSchema>;
export type WorldCreate = z.infer<typeof worldCreateSchema>;
export type WorldUpdate = z.infer<typeof worldUpdateSchema>;

export const npcCharacterSelectSchema = createSelectSchema(npcCharacters).transform((row) => ({
  ...row,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
}));

export const npcCharacterCreateSchema = z.object({
  worldId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().min(1),
  imageBase64: z.string().min(1),
  imageMediaType: z.literal('image/png'),
  generationPrompt: z.string().optional(),
  generationSetting: z.string().optional(),
  generationTone: z.string().optional(),
});

export type NpcCharacterCreate = z.infer<typeof npcCharacterCreateSchema>;

export const npcCharacterUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
});

export type NpcCharacterSelect = z.infer<typeof npcCharacterSelectSchema>;
export type NpcCharacterUpdate = z.infer<typeof npcCharacterUpdateSchema>;
