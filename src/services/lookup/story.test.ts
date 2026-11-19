import { describe, expect, it } from 'vitest';

import { isAside, nameWords, sentencesOf, storyPart } from './story';
import { plotOpening } from './wikipedia';

/** Rocco's page for "A hora da estrela" (2026), as plain text. */
const ROCCO = [
  'Edição em capa dura com novo projeto gráfico do grande sucesso de Clarice Lispector.',
  'Uma ótima opção de presente para todas as ocasiões.',
  'Último livro de Clarice Lispector publicado em vida, A hora da estrela singulariza-se pela inteligente combinação de intimismo psicológico, crítica social e reflexões sobre a escrita.',
  'A nordestina Macabéa, a protagonista de A hora da estrela, é uma mulher miserável, que mal tem consciência de existir.',
  'Depois de perder seu único elo com o mundo, uma velha tia, ela viaja para o Rio, onde aluga um quarto, se emprega como datilógrafa e gasta suas horas ouvindo a Rádio Relógio.',
  'Apaixona-se, então, por Olímpico de Jesus, um metalúrgico nordestino, que logo a trai com uma colega de trabalho.',
  'O drama da cativante órfã alagoana Macabéa nos sensibiliza até hoje porque espelha a realidade de milhões de brasileiros que deixaram seus lares em busca de uma vida melhor.',
  'Todavia, tudo o que encontraram nas metrópoles foi tristeza, solidão e a falta de perspectiva.',
].join(' ');

/** The same publisher's older text, the one Google Books carries: an essay on the author. */
const ESSAY = [
  'Pouco antes de morrer, em 1977, Clarice Lispector decide se afastar da inflexão intimista que caracteriza sua escrita para desafiar a realidade.',
  'O resultado desse salto na extroversão é A hora da estrela, o livro mais surpreendente que escreveu.',
].join(' ');

describe('storyPart', () => {
  it('keeps only the run of sentences that tells the story', () => {
    expect(storyPart(ROCCO)).toBe(
      [
        'A nordestina Macabéa, a protagonista de A hora da estrela, é uma mulher miserável, que mal tem consciência de existir.',
        'Depois de perder seu único elo com o mundo, uma velha tia, ela viaja para o Rio, onde aluga um quarto, se emprega como datilógrafa e gasta suas horas ouvindo a Rádio Relógio.',
        'Apaixona-se, então, por Olímpico de Jesus, um metalúrgico nordestino, que logo a trai com uma colega de trabalho.',
      ].join(' '),
    );
  });

  it('gives nothing for a text that only discusses the author', () => {
    expect(storyPart(ESSAY)).toBeNull();
  });

  it('stops before a sentence that gives the ending away', () => {
    const text =
      'Fabiano, Sinhá Vitória, os dois meninos e a cachorra Baleia atravessam o sertão fugindo da seca, à procura de um lugar onde possam ficar. ' +
      'No final, a família parte de novo.';
    expect(storyPart(text)).toMatch(/^Fabiano.*ficar\.$/);
  });

  it('tells sales talk and reception from the story', () => {
    expect(isAside('Uma ótima opção de presente para todas as ocasiões.')).toBe(true);
    expect(isAside('Vencedor do Prêmio Jabuti de 2020.')).toBe(true);
    expect(isAside('O romance narra as desventuras de Macabéa no Rio de Janeiro.')).toBe(false);
  });

  it('treats a sentence naming the author as about the author', () => {
    const author = nameWords(['Gabriel García Márquez']);
    expect(
      isAside(
        'Em nenhum outro livro García Márquez empenhou-se tanto para alcançar o tom.',
        author,
      ),
    ).toBe(true);
    expect(isAside('Macondo nasce às margens de um rio de águas diáfanas.', author)).toBe(false);
  });

  it('splits sentences across paragraphs', () => {
    expect(sentencesOf('Ela viaja. Lá se emprega.\nE ouve o rádio!')).toEqual([
      'Ela viaja.',
      'Lá se emprega.',
      'E ouve o rádio!',
    ]);
  });
});

describe('plotOpening', () => {
  it('takes the first paragraph of the plot section only', () => {
    const extract = [
      'A Hora da Estrela é um romance de Clarice Lispector.',
      '== Enredo ==',
      'O romance narra as desventuras de Macabéa, recém-chegada do Nordeste ao Rio de Janeiro.',
      'Ao sair da casa da cartomante, Macabéa é atropelada.',
      '== Narrativa ==',
      'O narrador é Rodrigo S.M.',
    ].join('\n');
    expect(plotOpening(extract)).toBe(
      'O romance narra as desventuras de Macabéa, recém-chegada do Nordeste ao Rio de Janeiro.',
    );
  });

  it('gives up when the plot section opens with a quotation', () => {
    const extract = [
      '== Enredo ==',
      'A história começa com uma citação do Apocalipse:',
      'Vi uma Fera.',
      'Johan é salvo.',
    ].join('\n');
    expect(plotOpening(extract)).toBeNull();
  });

  it('finds nothing in an article without a plot section', () => {
    expect(plotOpening('Um livro.\n== Narrativa ==\nSobre a narração.')).toBeNull();
  });
});
