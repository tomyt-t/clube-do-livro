import type { Book } from '@/domain/types';

/**
 * Sample readings for the demo, typed the way members would type them.
 * The synopses were written for this demo, not copied from publishers.
 */

function book(title: string, cover: number, wiki: string, synopsis: string): Book {
  return {
    title,
    synopsis,
    synopsisSource: null,
    synopsisUrl: `https://pt.wikipedia.org/wiki/${wiki}`,
    coverUrl: `https://covers.openlibrary.org/b/id/${String(cover)}-L.jpg`,
    coverSourceUrl: 'https://openlibrary.org/',
  };
}

export const DEMO_BOOKS = {
  hora: book(
    'A Hora da Estrela, Clarice Lispector',
    650866,
    'A_Hora_da_Estrela',
    'Um narrador inquieto tenta contar a vida de Macabéa, alagoana pobre e quase invisível no Rio de Janeiro, e acaba falando tanto dela quanto de si mesmo.',
  ),
  dom: book(
    'Dom Casmurro, Machado de Assis',
    647501,
    'Dom_Casmurro',
    'Já velho, Bento Santiago reconta o amor de juventude por Capitu e a desconfiança que tomou o casamento. Quem lê decide até onde acreditar nele.',
  ),
  /** The same book as `dom`, typed by someone else: the review flags them. */
  casmurro: book(
    'Dom Casmurro',
    647501,
    'Dom_Casmurro',
    'Já velho, Bento Santiago reconta o amor de juventude por Capitu e a desconfiança que tomou o casamento. Quem lê decide até onde acreditar nele.',
  ),
  vidas: book(
    'Vidas Secas, Graciliano Ramos',
    12369687,
    'Vidas_Secas',
    'Fabiano, Sinhá Vitória, os dois meninos e a cachorra Baleia atravessam o sertão fugindo da seca, em capítulos curtos que quase podem ser lidos fora de ordem.',
  ),
  quarto: book(
    'Quarto de Despejo, Carolina Maria de Jesus',
    295782,
    'Quarto_de_Despejo',
    'O diário de Carolina, catadora de papel na favela do Canindé, em São Paulo: a fome, os filhos, os vizinhos e a escrita como forma de resistir.',
  ),
  torto: book(
    'Torto Arado, Itamar Vieira Junior',
    12369648,
    'Torto_Arado',
    'Duas irmãs crescem numa fazenda da Chapada Diamantina, unidas por um acidente na infância e pela luta dos trabalhadores pelo direito à terra.',
  ),
  ensaio: book(
    'Ensaio sobre a Cegueira, José Saramago',
    10482411,
    'Ensaio_sobre_a_Cegueira',
    'Uma cegueira branca se espalha por uma cidade sem nome. Os primeiros doentes são isolados num manicômio, e só uma mulher continua enxergando.',
  ),
  bras: book(
    'Memórias Póstumas de Brás Cubas, Machado de Assis',
    123152,
    'Memórias_Póstumas_de_Brás_Cubas',
    'Depois de morto, Brás Cubas resolve escrever as próprias memórias, com ironia e sem pressa, e passa a limpo uma vida de privilégios e pequenas vaidades.',
  ),
  avesso: book(
    'O Avesso da Pele, Jeferson Tenório',
    12769862,
    'O_Avesso_da_Pele',
    'Pedro reconstrói a história do pai, professor negro morto numa abordagem policial em Porto Alegre, e junto com ela a própria.',
  ),
  cem: book(
    'Cem Anos de Solidão, Gabriel García Márquez',
    12627383,
    'Cem_Anos_de_Solidão',
    'Sete gerações da família Buendía vivem em Macondo, a cidade que fundaram, entre guerras, invenções, amores repetidos e acontecimentos que ninguém estranha.',
  ),
} satisfies Record<string, Book>;
