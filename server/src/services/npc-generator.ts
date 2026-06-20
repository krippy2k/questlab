import { TRPCError } from '@trpc/server';
import { APIError } from 'openai';
import { getOpenAIClient } from '../lib/openai';
import { getOpenAITextModel } from '../lib/env';
import {
  npcGenerateInputSchema,
  npcTextOutputSchema,
  type NpcGenerateInput,
  type NpcGenerateOutput,
} from '../schema/npc';

const TEXT_SYSTEM_PROMPT = `You are an expert Dungeons & Dragons Dungeon Master assistant.
Generate a single NPC based on the user's request.
Respond with JSON containing exactly two keys: "name" and "description".
The description must be multi-paragraph session-prep prose covering appearance, personality, motivation, and a concrete hook the DM can use at the table.
Honor the user's prompt, setting, and tone when provided.`;

function mapOpenAIError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  const apiError = error instanceof APIError ? error : undefined;
  const status = apiError?.status;

  if (status === 429) {
    return new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'OpenAI rate limit reached. Please try again shortly.',
    });
  }

  if (status === 401 || status === 403) {
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'NPC generation is temporarily unavailable.',
    });
  }

  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Failed to generate NPC. Please try again.',
  });
}

function buildUserMessage(input: NpcGenerateInput): string {
  const parts = [`Prompt: ${input.prompt}`];
  if (input.setting) {
    parts.push(`Setting: ${input.setting}`);
  }
  if (input.tone) {
    parts.push(`Tone: ${input.tone}`);
  }
  return parts.join('\n');
}

function buildImagePrompt(name: string, description: string): string {
  const excerpt = description.slice(0, 400).replace(/\s+/g, ' ').trim();
  return [
    'Fantasy RPG character portrait, bust shot, detailed digital painting,',
    'D&D tabletop game art style, neutral background, no text or watermark.',
    `Character: ${name}. ${excerpt}`,
  ].join(' ');
}

async function generateNpcText(input: NpcGenerateInput): Promise<{ name: string; description: string }> {
  const openai = getOpenAIClient();

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: getOpenAITextModel(),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: TEXT_SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(input) },
      ],
    });
  } catch (error) {
    throw mapOpenAIError(error);
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to generate NPC text.',
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to parse NPC text response.',
    });
  }

  const result = npcTextOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'NPC text response was invalid.',
    });
  }

  return result.data;
}

async function generateNpcPortrait(name: string, description: string): Promise<string> {
  const openai = getOpenAIClient();
  const imagePrompt = buildImagePrompt(name, description);

  let imageResponse;
  try {
    // gpt-image-1 always returns base64 in b64_json; response_format is unsupported.
    imageResponse = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      size: '1024x1024',
    });
  } catch (error) {
    throw mapOpenAIError(error);
  }

  const imageBase64 = imageResponse.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to generate NPC portrait.',
    });
  }

  return imageBase64;
}

export async function generateNpc(rawInput: NpcGenerateInput): Promise<NpcGenerateOutput> {
  const input = npcGenerateInputSchema.parse(rawInput);
  const { name, description } = await generateNpcText(input);
  const imageBase64 = await generateNpcPortrait(name, description);

  return {
    name,
    description,
    imageBase64,
    imageMediaType: 'image/png',
  };
}
