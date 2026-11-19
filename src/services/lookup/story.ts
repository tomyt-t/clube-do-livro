import { spoilerCount } from './language';
import { normalize } from './match';

/**
 * The part of a synopsis that tells the story. Publishers' texts mix it
 * with sales talk ("edição em capa dura"), the author's career and the
 * book's reception; only the story is kept, and only its opening run,
 * so a text that drifts into commentary stops there. Plain word cues: no
 * model.
 */

/** Sales talk and edition details. */
const SALES = [
  /\bcapa dura\b/,
  /\bprojeto grafico\b/,
  /\bopcao de presente\b/,
  /\bpresente (para|ideal)\b/,
  /\bedicao (especial|de colecionador|comemorativa|definitiva|ilustrada|de luxo|economica)\b/,
  /\b(nova|esta|nesta) edicao\b/,
  /\bpre venda\b/,
  /\b(frete|brinde|chaveiro|mini livro|book charm|marcador)\b/,
  /\bserie (original )?d[ao] (hbo|netflix|amazon|max|prime|disney)\b/,
  /\bchega (neste|nesta|ao|aos|as|aos cinemas)\b/,
  /\b(leia o livro|adquira|compre|garanta ja)\b/,
  /\b(ilustracoes|ilustrad[oa]s?|desenhos originais|elementos interativos|poster|exclusiv[oa]s?)\b/,
  /\b(esta versao|na integra|texto integral|agora com)\b/,
  /\b(shipping|paperbacks?|money back|why buy|low quality|binding|font size|pages fall)\b/,
];

/** The author, the book's history and its reception, rather than its story. */
const ASIDES = [
  /\b(escreveu|escrito por|publicou|publicad[oa]s?|publicacao|lancad[oa]s?|lancamento)\b/,
  /\b(traduzid[oa]s?|traducao|edicoes|exemplares|vendeu|mais vendid[oa]s?)\b/,
  /\b(best ?seller|sucesso|fenomeno|premi\w*|jabuti|nobel|pulitzer|booker|vencedor\w*)\b/,
  /\b(aclamad[oa]|consagrad[oa]|classic[oa]s?|obra prima|canone|imperdivel)\b/,
  /\b(escritor|escritora|autor|autora|romancista|leitor|leitores|critica|criticos)\b/,
  /\b(sua escrita|sua obra|sua carreira|de estreia|livro mais|romance mais)\b/,
  /\b(adaptad[oa]|adaptacao|filme|cinema|inspirad[oa])\b/,
  /\b(nos sensibiliza|ate hoje|singulariza|literatura|atualidade|atemporal)\b/,
  /\b(considerad[oa]s?|reconhecid[oa]s?|mundialmente|elogiad\w*|leram|leitura|escrever)\b/,
  /\b(esta|nesta|essa|uma|na|da) obra\b/,
];

/** A list item ("• desenhos originais…") is an edition's extras, never the story. */
const isListItem = (sentence: string) => /^[•·▪*-]/.test(sentence);

/** Sentences, across paragraphs: "Ela viaja para o Rio. Lá…" → two. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?…])\s+(?=["“'(]?[\p{Lu}\d])/u))
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** Surnames long enough to be told apart: "Gabriel García Márquez" → ["gabriel", "garcia", "marquez"]. */
export function nameWords(names: readonly string[]): string[] {
  return names.flatMap((name) =>
    normalize(name)
      .split(' ')
      .filter((word) => word.length >= 4),
  );
}

/** About the book rather than its story: sales talk, reception, or the author by name. */
export function isAside(sentence: string, author: readonly string[] = []): boolean {
  const plain = normalize(sentence);
  const words = ` ${plain} `;
  return (
    author.some((word) => words.includes(` ${word} `)) ||
    isListItem(sentence) ||
    SALES.some((cue) => cue.test(plain)) ||
    ASIDES.some((cue) => cue.test(plain)) ||
    spoilerCount(sentence) > 0
  );
}

/** Long enough to say what the story is about. */
const ENOUGH = 120;
const TOO_LITTLE = 80;

/**
 * The first run of story sentences long enough to read on its own (or the
 * longest run), or null when the text is all commentary.
 */
export function storyPart(text: string, author: readonly string[] = []): string | null {
  const runs: string[] = [];
  let run: string[] = [];
  for (const sentence of sentencesOf(text)) {
    if (!isAside(sentence, author)) run.push(sentence);
    else if (run.length > 0) {
      runs.push(run.join(' '));
      run = [];
    }
  }
  if (run.length > 0) runs.push(run.join(' '));
  const chosen =
    runs.find((candidate) => candidate.length >= ENOUGH) ??
    [...runs].sort((a, b) => b.length - a.length)[0];
  return chosen && chosen.length >= TOO_LITTLE ? chosen.replace(/\s+([,.;:!?])/g, '$1') : null;
}

const isSales = (sentence: string) => {
  const plain = normalize(sentence);
  return isListItem(sentence) || SALES.some((cue) => cue.test(plain)) || spoilerCount(sentence) > 0;
};

/**
 * The whole text without sales talk or spoilers: offered last, when no part
 * of any text tells the story (a diary, an essay), so there is still
 * something to start from.
 */
export function withoutSales(text: string): string | null {
  const kept = sentencesOf(text)
    .filter((sentence) => !isSales(sentence))
    .join(' ');
  return kept.length >= TOO_LITTLE ? kept.replace(/\s+([,.;:!?])/g, '$1') : null;
}
