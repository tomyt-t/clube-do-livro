import type { SchemaRequest } from 'firebase/ai';
import type { FirebaseApp } from 'firebase/app';

import type { DuplicateChecker } from '../backend';
import {
  combineFindings,
  DUPLICATE_INSTRUCTIONS,
  DUPLICATE_SCHEMA,
  duplicatePrompt,
  parseDuplicateGroups,
} from '../duplicates/prompt';
import { exactChecker, exactFindings } from '../duplicates/same-title';

/**
 * Gemini through Firebase AI Logic: the browser asks through Firebase, so no
 * Gemini key ever ships with the site (and App Check guards it). Without a
 * model configured, or if it fails, the exact check still runs: the same
 * title and author is merged, the same title alone goes to the organizer.
 * The SDK loads only when a check actually runs.
 */
export function createFirebaseChecker(app: FirebaseApp, model: string | null): DuplicateChecker {
  if (!model) return exactChecker;
  return {
    findDuplicates: async (nominations) => {
      const exact = exactFindings(nominations);
      if (nominations.length < 2) return exact;
      try {
        const { getAI, getGenerativeModel, GoogleAIBackend } = await import('firebase/ai');
        // One-use App Check tokens: a captured token cannot be replayed elsewhere.
        const ai = getAI(app, {
          backend: new GoogleAIBackend(),
          useLimitedUseAppCheckTokens: true,
        });
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
        return combineFindings(exact, parseDuplicateGroups(result.response.text(), nominations));
      } catch {
        return exact;
      }
    },
  };
}
