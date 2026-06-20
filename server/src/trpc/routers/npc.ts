import { npcGenerateInputSchema, npcGenerateOutputSchema } from '../../schema/npc';
import { generateNpc } from '../../services/npc-generator';
import { router, signedInProcedure } from '../init';

export const npcRouter = router({
  generate: signedInProcedure
    .input(npcGenerateInputSchema)
    .mutation(async ({ input }) => {
      const result = await generateNpc(input);
      return npcGenerateOutputSchema.parse(result);
    }),
});
