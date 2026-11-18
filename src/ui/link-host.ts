/**
 * Where a member's link goes, shown next to it: link text alone could hide
 * a fake sign-in page behind "Abrir o link".
 */
export function linkHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** "Abrir o link (pt.wikipedia.org)". */
export function withHost(label: string, url: string): string {
  const host = linkHost(url);
  return host ? `${label} (${host})` : label;
}
