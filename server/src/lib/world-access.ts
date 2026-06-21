import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import type { DatabaseConnection } from './db';
import { worlds, type World } from '../schema/worlds';

export async function getOwnedWorld(
  db: DatabaseConnection,
  worldId: string,
  userId: string
): Promise<World> {
  const [world] = await db
    .select()
    .from(worlds)
    .where(and(eq(worlds.id, worldId), eq(worlds.user_id, userId)))
    .limit(1);

  if (!world) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'World not found' });
  }

  return world;
}
