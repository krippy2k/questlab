import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { worlds } from '../../schema/worlds';
import { worldCreateSchema, worldSelectSchema, worldUpdateSchema } from '../../schema/zod';
import { getOwnedWorld } from '../../lib/world-access';
import { protectedProcedure, router } from '../init';

export const worldRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(worlds)
      .where(eq(worlds.user_id, ctx.user.id))
      .orderBy(desc(worlds.updated_at));

    return rows.map((row) => worldSelectSchema.parse(row));
  }),

  get: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const world = await getOwnedWorld(ctx.db, input.id, ctx.user.id);
    return worldSelectSchema.parse(world);
  }),

  create: protectedProcedure.input(worldCreateSchema).mutation(async ({ ctx, input }) => {
    const id = crypto.randomUUID();
    const now = new Date();

    await ctx.db.insert(worlds).values({
      id,
      user_id: ctx.user.id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      created_at: now,
      updated_at: now,
    });

    const world = await getOwnedWorld(ctx.db, id, ctx.user.id);
    return worldSelectSchema.parse(world);
  }),

  update: protectedProcedure.input(worldUpdateSchema).mutation(async ({ ctx, input }) => {
    await getOwnedWorld(ctx.db, input.id, ctx.user.id);

    const patch: Partial<typeof worlds.$inferInsert> = {
      updated_at: new Date(),
    };
    if (input.name !== undefined) {
      patch.name = input.name.trim();
    }
    if (input.description !== undefined) {
      patch.description = input.description?.trim() || null;
    }

    await ctx.db.update(worlds).set(patch).where(eq(worlds.id, input.id));

    const world = await getOwnedWorld(ctx.db, input.id, ctx.user.id);
    return worldSelectSchema.parse(world);
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await getOwnedWorld(ctx.db, input.id, ctx.user.id);
      await ctx.db.delete(worlds).where(eq(worlds.id, input.id));
      return { ok: true as const };
    }),
});
