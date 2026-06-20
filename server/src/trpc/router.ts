import { testDatabaseConnection } from '../lib/db';
import { publicProcedure, router } from './init';
import { npcRouter } from './routers/npc';
import { userRouter } from './routers/user';

export const appRouter = router({
  health: publicProcedure.query(async () => {
    const connectionHealthy = await testDatabaseConnection();
    return {
      ok: true as const,
      connectionHealthy,
      timestamp: new Date().toISOString(),
    };
  }),
  user: userRouter,
  npc: npcRouter,
});

export type AppRouter = typeof appRouter;
