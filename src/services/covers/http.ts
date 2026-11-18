import type { SourceRequest } from './types';

export async function fetchJson(
  url: string,
  { fetcher, signal }: SourceRequest,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetcher(url, { ...init, signal: signal ?? null });
  if (!response.ok) throw new Error(`HTTP ${String(response.status)} em ${new URL(url).host}`);
  return response.json();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function listAt(value: unknown, key: string): unknown[] {
  if (!isRecord(value)) return [];
  const list = value[key];
  return Array.isArray(list) ? list : [];
}

export function textAt(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const text = value[key];
  return typeof text === 'string' && text.trim() !== '' ? text.trim() : null;
}

/** "Kentaro Miura · Mangá · 1989" without the empty parts. */
export function joinDetails(parts: readonly (string | number | null | undefined)[]): string {
  return parts
    .filter((part) => part !== null && part !== undefined && part !== '')
    .map(String)
    .join(' · ');
}
