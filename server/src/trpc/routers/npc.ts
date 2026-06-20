import { npcGenerateInputSchema, npcGenerateOutputSchema } from '../../schema/npc';
import { generateNpc } from '../../services/npc-generator';
import { protectedProcedure, router } from '../init';

export const npcRouter = router({
  generate: protectedProcedure
    .input(npcGenerateInputSchema)
    .mutation(async ({ input }) => {
      const result = await generateNpc(input);
      return npcGenerateOutputSchema.parse(result);
    }),
});
