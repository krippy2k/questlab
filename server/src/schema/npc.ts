import { z } from 'zod';

export const npcGenerateInputSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  setting: z.string().trim().max(500).optional(),
  tone: z.string().trim().max(200).optional(),
});

export const npcGenerateOutputSchema = z.object({
  name: z.string(),
  description: z.string(),
  imageBase64: z.string(),
  imageMediaType: z.literal('image/png'),
});

export const npcTextOutputSchema = npcGenerateOutputSchema.pick({
  name: true,
  description: true,
});

export type NpcGenerateInput = z.infer<typeof npcGenerateInputSchema>;
export type NpcGenerateOutput = z.infer<typeof npcGenerateOutputSchema>;
