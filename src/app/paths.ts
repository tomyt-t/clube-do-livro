/** Routes live in the URL hash (`#/votacao`), so GitHub Pages needs no rewrites. */
export const PATHS = {
  reading: '/',
  election: '/votacao',
  history: '/historico',
  /** Only for the organizer; reached from the account menu. */
  admin: '/organizar',
} as const;
