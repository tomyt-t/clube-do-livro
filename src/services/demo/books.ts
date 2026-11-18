import type { Book } from '@/domain/types';

/** Sample books for the demo. Synopses are original short summaries. */

function book(
  title: string,
  author: string,
  details: { cover: number; year: number; pages: number | null; wiki: string; synopsis: string },
): Book {
  return {
    title,
    authors: [author],
    synopsis: details.synopsis,
    synopsisUrl: `https://pt.wikipedia.org/wiki/${details.wiki}`,
    coverUrl: `https://covers.openlibrary.org/b/id/${String(details.cover)}-L.jpg`,
    publishedYear: details.year,
    pageCount: details.pages,
  };
}

export const DEMO_BOOKS = {
  hora: book('A Hora da Estrela', 'Clarice Lispector', {
    cover: 650866,
    year: 1977,
    pages: 96,
    wiki: 'A_Hora_da_Estrela',
    synopsis:
      'Um narrador inquieto tenta contar a vida de Macabéa, datilógrafa alagoana que sobrevive no Rio de Janeiro quase sem perceber a si mesma.\n\nÚltimo romance publicado por Clarice: breve, estranho e devastador.',
  }),
  dom: book('Dom Casmurro', 'Machado de Assis', {
    cover: 647501,
    year: 1899,
    pages: 269,
    wiki: 'Dom_Casmurro',
    synopsis:
      'Bento Santiago, já velho, revisita a juventude e o casamento com Capitu para provar uma traição que talvez só exista na cabeça dele.',
  }),
  vidas: book('Vidas Secas', 'Graciliano Ramos', {
    cover: 12369687,
    year: 1938,
    pages: 155,
    wiki: 'Vidas_Secas',
    synopsis:
      'Fabiano, Sinhá Vitória, os dois meninos e a cachorra Baleia atravessam o sertão fugindo da seca, numa prosa seca como a paisagem.',
  }),
  quarto: book('Quarto de Despejo', 'Carolina Maria de Jesus', {
    cover: 295782,
    year: 1960,
    pages: 182,
    wiki: 'Quarto_de_Despejo',
    synopsis:
      'O diário de Carolina, catadora de papel na favela do Canindé, em São Paulo, nos anos 1950: a fome, os filhos e a escrita como forma de resistir.',
  }),
  torto: book('Torto Arado', 'Itamar Vieira Junior', {
    cover: 12369648,
    year: 2019,
    pages: 264,
    wiki: 'Torto_Arado',
    synopsis:
      'Duas irmãs crescem numa fazenda da Chapada Diamantina, ligadas para sempre por um acidente na infância. Uma história sobre terra, trabalho e a herança da escravidão.',
  }),
  ensaio: book('Ensaio sobre a Cegueira', 'José Saramago', {
    cover: 10482411,
    year: 1995,
    pages: 352,
    wiki: 'Ensaio_sobre_a_Cegueira',
    synopsis:
      'Uma epidemia de cegueira branca se espalha por uma cidade sem nome, e os primeiros infectados são isolados num manicômio. Só uma mulher continua enxergando.',
  }),
  bras: book('Memórias Póstumas de Brás Cubas', 'Machado de Assis', {
    cover: 123152,
    year: 1881,
    pages: 242,
    wiki: 'Memórias_Póstumas_de_Brás_Cubas',
    synopsis:
      'Um defunto autor resolve contar a própria vida, com ironia e nenhuma pressa. O romance que virou a literatura brasileira do avesso.',
  }),
  avesso: book('O Avesso da Pele', 'Jeferson Tenório', {
    cover: 12769862,
    year: 2020,
    pages: null,
    wiki: 'O_Avesso_da_Pele',
    synopsis:
      'Pedro reconstrói a história do pai, professor negro morto numa abordagem policial em Porto Alegre, e com ela a do racismo que atravessou a família.',
  }),
  cem: book('Cem Anos de Solidão', 'Gabriel García Márquez', {
    cover: 12627383,
    year: 1967,
    pages: 432,
    wiki: 'Cem_Anos_de_Solidão',
    synopsis:
      'Sete gerações da família Buendía na cidade inventada de Macondo, entre guerras, pestes e amores que se repetem.\n\nO romance que levou o realismo mágico ao mundo inteiro.',
  }),
} satisfies Record<string, Book>;
