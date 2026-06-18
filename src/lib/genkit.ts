'use server';
/**
 * @fileOverview Genkit initialization for production build.
 */

// @ts-ignore
import { genkit } from 'genkit';
// @ts-ignore
import { googleAI } from '@genkit-ai/google-genai';

// Initialize Genkit with Google AI plugin
export const ai = genkit({
  plugins: [googleAI()],
});
