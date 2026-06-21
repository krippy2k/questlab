import { index, text, timestamp } from 'drizzle-orm/pg-core';
import { appSchema, users } from './users';

export const worlds = appSchema.table(
  'worlds',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    description: text('description'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('worlds_user_id_idx').on(table.user_id),
  })
);

export type World = typeof worlds.$inferSelect;
export type NewWorld = typeof worlds.$inferInsert;
