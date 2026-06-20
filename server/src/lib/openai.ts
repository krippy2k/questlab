import OpenAI from 'openai';
import { getOpenAIApiKey } from './env';

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: getOpenAIApiKey() });
  }
  return client;
}
