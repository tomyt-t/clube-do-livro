/** Routes live in the URL hash (`#/votacao`), so GitHub Pages needs no rewrites. */
export const PATHS = {
  reading: '/',
  election: '/votacao',
  history: '/historico',
} as const;
