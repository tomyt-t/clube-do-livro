import type { DecisionMethod } from '@/domain/types';

/** "Escolhida …": how the club got to a book. */
export const CHOSEN: Record<DecisionMethod, string> = {
  votes: 'na votação',
  'first-choices': 'no desempate',
  draw: 'no sorteio',
  unopposed: 'sem disputa',
};
