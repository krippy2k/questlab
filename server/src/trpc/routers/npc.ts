import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { npcCharacters } from '../../schema/npc-characters';
import { npcGenerateInputSchema, npcGenerateOutputSchema } from '../../schema/npc';
import {
  npcCharacterCreateSchema,
  npcCharacterSelectSchema,
  npcCharacterUpdateSchema,
} from '../../schema/zod';
import { generateNpc } from '../../services/npc-generator';
import { getOwnedWorld } from '../../lib/world-access';
import { router, signedInProcedure, protectedProcedure } from '../init';

async function getOwnedNpc(
  db: Parameters<typeof getOwnedWorld>[0],
  npcId: string,
  userId: string
) {
  const [npc] = await db.select().from(npcCharacters).where(eq(npcCharacters.id, npcId)).limit(1);
  if (!npc) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'NPC not found' });
  }

  await getOwnedWorld(db, npc.world_id, userId);
  return npc;
}

export const npcRouter = router({
  generate: signedInProcedure
    .input(npcGenerateInputSchema)
    .mutation(async ({ input }) => {
      const result = await generateNpc(input);
      return npcGenerateOutputSchema.parse(result);
    }),

  listByWorld: protectedProcedure
    .input(z.object({ worldId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await getOwnedWorld(ctx.db, input.worldId, ctx.user.id);

      const rows = await ctx.db
        .select()
        .from(npcCharacters)
        .where(eq(npcCharacters.world_id, input.worldId))
        .orderBy(desc(npcCharacters.created_at));

      return rows.map((row) => npcCharacterSelectSchema.parse(row));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const npc = await getOwnedNpc(ctx.db, input.id, ctx.user.id);
      return npcCharacterSelectSchema.parse(npc);
    }),

  create: protectedProcedure.input(npcCharacterCreateSchema).mutation(async ({ ctx, input }) => {
    await getOwnedWorld(ctx.db, input.worldId, ctx.user.id);

    const id = crypto.randomUUID();
    const now = new Date();

    await ctx.db.insert(npcCharacters).values({
      id,
      world_id: input.worldId,
      name: input.name,
      description: input.description,
      image_base64: input.imageBase64,
      image_media_type: input.imageMediaType,
      generation_prompt: input.generationPrompt ?? null,
      generation_setting: input.generationSetting ?? null,
      generation_tone: input.generationTone ?? null,
      created_at: now,
      updated_at: now,
    });

    const [npc] = await ctx.db.select().from(npcCharacters).where(eq(npcCharacters.id, id)).limit(1);
    if (!npc) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create NPC' });
    }

    return npcCharacterSelectSchema.parse(npc);
  }),

  update: protectedProcedure.input(npcCharacterUpdateSchema).mutation(async ({ ctx, input }) => {
    await getOwnedNpc(ctx.db, input.id, ctx.user.id);

    const patch: Partial<typeof npcCharacters.$inferInsert> = {
      updated_at: new Date(),
    };
    if (input.name !== undefined) {
      patch.name = input.name.trim();
    }
    if (input.description !== undefined) {
      patch.description = input.description;
    }

    await ctx.db.update(npcCharacters).set(patch).where(eq(npcCharacters.id, input.id));

    const [npc] = await ctx.db
      .select()
      .from(npcCharacters)
      .where(eq(npcCharacters.id, input.id))
      .limit(1);
    if (!npc) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'NPC not found' });
    }

    return npcCharacterSelectSchema.parse(npc);
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await getOwnedNpc(ctx.db, input.id, ctx.user.id);
      await ctx.db.delete(npcCharacters).where(eq(npcCharacters.id, input.id));
      return { ok: true as const };
    }),

  copyToWorld: protectedProcedure
    .input(
      z.object({
        npcId: z.string().uuid(),
        targetWorldId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const source = await getOwnedNpc(ctx.db, input.npcId, ctx.user.id);
      await getOwnedWorld(ctx.db, input.targetWorldId, ctx.user.id);

      if (source.world_id === input.targetWorldId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'NPC is already in this world',
        });
      }

      const id = crypto.randomUUID();
      const now = new Date();

      await ctx.db.insert(npcCharacters).values({
        id,
        world_id: input.targetWorldId,
        name: source.name,
        description: source.description,
        image_base64: source.image_base64,
        image_media_type: source.image_media_type,
        generation_prompt: source.generation_prompt,
        generation_setting: source.generation_setting,
        generation_tone: source.generation_tone,
        created_at: now,
        updated_at: now,
      });

      const [npc] = await ctx.db.select().from(npcCharacters).where(eq(npcCharacters.id, id)).limit(1);
      if (!npc) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to copy NPC' });
      }

      return npcCharacterSelectSchema.parse(npc);
    }),
});
