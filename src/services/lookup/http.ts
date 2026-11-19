import type { SourceRequest } from './types';

/** Small helpers for reading the catalogs' JSON, which is never trusted to have any shape. */

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
