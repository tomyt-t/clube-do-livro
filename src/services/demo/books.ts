import type { Book } from '@/domain/types';

/** Sample readings for the demo, typed the way members would type them. */

function book(title: string, cover: number, wiki: string): Book {
  return {
    title,
    synopsisUrl: `https://pt.wikipedia.org/wiki/${wiki}`,
    coverUrl: `https://covers.openlibrary.org/b/id/${String(cover)}-L.jpg`,
  };
}

export const DEMO_BOOKS = {
  hora: book('A Hora da Estrela, Clarice Lispector', 650866, 'A_Hora_da_Estrela'),
  dom: book('Dom Casmurro, Machado de Assis', 647501, 'Dom_Casmurro'),
  vidas: book('Vidas Secas, Graciliano Ramos', 12369687, 'Vidas_Secas'),
  quarto: book('Quarto de Despejo, Carolina Maria de Jesus', 295782, 'Quarto_de_Despejo'),
  torto: book('Torto Arado, Itamar Vieira Junior', 12369648, 'Torto_Arado'),
  ensaio: book('Ensaio sobre a Cegueira, José Saramago', 10482411, 'Ensaio_sobre_a_Cegueira'),
  bras: book(
    'Memórias Póstumas de Brás Cubas, Machado de Assis',
    123152,
    'Memórias_Póstumas_de_Brás_Cubas',
  ),
  avesso: book('O Avesso da Pele, Jeferson Tenório', 12769862, 'O_Avesso_da_Pele'),
  cem: book('Cem Anos de Solidão, Gabriel García Márquez', 12627383, 'Cem_Anos_de_Solidão'),
} satisfies Record<string, Book>;
