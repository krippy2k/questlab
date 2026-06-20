import OpenAI from 'openai';
import { getEnv } from './env';

let client: OpenAI | null = null;

export class OpenAINotConfiguredError extends Error {
  constructor() {
    super('OPENAI_NOT_CONFIGURED');
    this.name = 'OpenAINotConfiguredError';
  }
}

export function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = getEnv('OPENAI_API_KEY');
    if (!apiKey) {
      throw new OpenAINotConfiguredError();
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}
