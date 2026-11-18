import type { SchemaRequest } from 'firebase/ai';
import type { FirebaseApp } from 'firebase/app';

import type { DuplicateChecker } from '../backend';
import {
  DUPLICATE_INSTRUCTIONS,
  DUPLICATE_SCHEMA,
  duplicatePrompt,
  parseDuplicateGroups,
} from '../duplicates/prompt';

/** Without a model configured there is no check: nothing is flagged. */
const NO_CHECK: DuplicateChecker = { findDuplicates: () => Promise.resolve([]) };

/**
 * Gemini through Firebase AI Logic: the browser asks through Firebase, so no
 * Gemini key ever ships with the site (and App Check guards it when set up).
 * The SDK loads only when a check actually runs.
 */
export function createFirebaseChecker(app: FirebaseApp, model: string | null): DuplicateChecker {
  if (!model) return NO_CHECK;
  return {
    findDuplicates: async (nominations) => {
      if (nominations.length < 2) return [];
      const { getAI, getGenerativeModel, GoogleAIBackend } = await import('firebase/ai');
      // One-use App Check tokens: a captured token cannot be replayed elsewhere.
      const ai = getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true });
      const gemini = getGenerativeModel(ai, {
        model,
        systemInstruction: DUPLICATE_INSTRUCTIONS,
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          // The SDK types the schema with its own enum; the plain shape is what it sends.
          responseSchema: DUPLICATE_SCHEMA as unknown as SchemaRequest,
        },
      });
      const titles = nominations.map(({ book }) => book.title);
      const result = await gemini.generateContent(duplicatePrompt(titles));
      return parseDuplicateGroups(result.response.text(), nominations);
    },
  };
}
