/**
 * Runs the cover and synopsis lookup against the real catalogs for a varied
 * list of readings, and writes a report to look at (HTML) and to compare
 * between runs (JSON). Local only: it never touches the club's database.
 *
 *   GOOGLE_BOOKS_KEY=... npx vite-node scripts/lookup-eval.ts <out-dir> [only-these, separated by |]
 *
 * The site's Google Books key only answers requests coming from the site, so
 * this sends the site's address as the referrer.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { lookupBook, type LookupResult } from '@/services/lookup';
import { imageSize } from '@/ui/data-image';

export const READINGS = [
  // Brazilian classics
  'Dom Casmurro',
  'Memórias Póstumas de Brás Cubas',
  'O Cortiço, Aluísio Azevedo',
  'Vidas Secas',
  'A Hora da Estrela',
  'Grande Sertão: Veredas',
  'Capitães da Areia',
  'O Alienista, Machado de Assis',
  // Brazilian, recent
  'Torto Arado',
  'Tudo é Rio, Carla Madeira',
  'O Avesso da Pele',
  'Quarto de Despejo',
  'Ainda Estou Aqui, Marcelo Rubens Paiva',
  'Ravier com J, Arthur do Val',
  // Translated
  'Os Miseráveis',
  'Les Misérables, Victor Hugo',
  'O Hobbit',
  'Cem Anos de Solidão',
  '1984, George Orwell',
  'A Metamorfose',
  'Ensaio sobre a Cegueira',
  'O Pequeno Príncipe',
  'Dublinenses, James Joyce',
  'O Marinheiro que Perdeu as Graças do Mar, Yukio Mishima',
  'The Day of the Door, Laurel Hightower',
  'O Xangô de Baker Street, Jô Soares',
  'O Senhor Embaixador, Érico Veríssimo',
  // Non-fiction
  'Sapiens',
  'Pequeno Manual Antirracista, Djamila Ribeiro',
  'Rápido e Devagar, Daniel Kahneman',
  // Series: never the wrong volume
  'Harry Potter e a Pedra Filosofal',
  'Harry Potter e o Cálice de Fogo',
  'Duna, Frank Herbert',
  'O Messias de Duna',
  'Fundação e Império, Isaac Asimov',
  // Manga and comics
  'Berserk',
  'One Piece',
  'Monster, Naoki Urasawa',
  'Persépolis',
  'Maus',
  'Watchmen',
  // Typos and missing accents
  'cem anos de solidao',
  'memorias postumas de bras cubas machado',
  'o pequeno principe',
];

const SITE = 'https://tomyt-t.github.io/clube-do-livro/';

/** Node's fetch, sending the site as referrer (browsers do this on their own). */
const fetcher: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  headers.set('Referer', SITE);
  // Wikimedia asks scripts to name themselves (browsers send their own).
  headers.set('User-Agent', 'clube-do-livro-lookup-eval/0.1 (local test)');
  return fetch(input, { ...init, headers });
};

/** Reads an image's size from its header, as an `<img>` would report it. */
async function measure(url: string) {
  try {
    const response = await fetch(url, {
      headers: { Referer: SITE },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return imageSize(new Uint8Array(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

/** A line on the terminal (the lint rule keeps console.log out of the app). */
const print = (line: string) =>
  process.stdout.write(`${line}
`);

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Row {
  reading: string;
  ms: number;
  result: LookupResult;
}

const escape = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );

/** Every synopsis found, one at a time: the source buttons switch between them. */
function synopsesHtml(synopses: LookupResult['synopses']): string {
  if (synopses.length === 0) return '<span class="miss">sem sinopse</span>';
  const tabs = synopses
    .map(
      (s, i) =>
        `<button type="button" class="tab${i === 0 ? ' on' : ''}" data-i="${String(i)}">${escape(s.label)}</button>`,
    )
    .join('');
  const panels = synopses
    .map(
      (s, i) =>
        `<div class="panel"${i === 0 ? '' : ' hidden'}><p>${escape(s.text)}</p><small><a href="${escape(s.sourceUrl)}">fonte</a> · ${String(s.text.length)} caracteres</small></div>`,
    )
    .join('');
  return `<div class="tabs">${tabs}</div>${panels}`;
}

function rowHtml({ reading, ms, result }: Row): string {
  const { work, covers, synopses, others } = result;
  const [cover, ...moreCovers] = covers;
  const found = work
    ? `<b>${escape(work.title)}</b> — ${escape(work.authors.join(', ') || 'autor ?')}<br><small>${escape(work.details)}</small>`
    : '<b class="miss">nada encontrado</b>';
  return `<tr>
<td class="q">${escape(reading)}<br><small>${String(ms)} ms</small></td>
<td>${found}${others.length ? `<br><small>outras: ${escape(others.map((o) => `${o.title} (${o.authors.join(', ')})`).join('; '))}</small>` : ''}</td>
<td class="c">${cover ? `<a href="${escape(cover.sourceUrl)}"><img src="${escape(cover.url)}" alt=""></a><br><small>${escape(cover.label)}</small>` : '<span class="miss">sem capa</span>'}
${moreCovers.map((c) => `<a href="${escape(c.sourceUrl)}" title="${escape(c.label)}"><img class="t" src="${escape(c.url)}" alt=""></a>`).join('')}</td>
<td class="s">${synopsesHtml(synopses)}</td>
</tr>`;
}

function reportHtml(rows: readonly Row[]): string {
  const withCover = rows.filter((r) => r.result.covers.length > 0).length;
  const withSynopsis = rows.filter((r) => r.result.synopses.length > 0).length;
  return `<!doctype html><meta charset="utf-8"><title>Busca de capas e sinopses</title>
<style>body{font:14px system-ui;margin:16px}table{border-collapse:collapse;width:100%}td{border-top:1px solid #ccc;padding:8px;vertical-align:top}
.q{width:14%}.c{width:18%}.s{width:44%}img{max-width:150px;max-height:225px}img.t{max-width:44px;max-height:66px;margin:4px 4px 0 0}
small{color:#555}.miss{color:#b00}.s p{margin:6px 0;line-height:1.45}
.tabs{display:flex;flex-wrap:wrap;gap:4px}.tab{font:12px system-ui;border:1px solid #bbb;background:#fff;border-radius:12px;padding:2px 8px;cursor:pointer}
.tab.on{background:#17433a;color:#fff;border-color:#17433a}</style>
<script>addEventListener('click',(e)=>{const b=e.target.closest('.tab');if(!b)return;const td=b.closest('td');
td.querySelectorAll('.tab').forEach((t)=>t.classList.toggle('on',t===b));
td.querySelectorAll('.panel').forEach((p,i)=>{p.hidden=String(i)!==b.dataset.i;});});</script>
<h1>Busca de capas e sinopses</h1><p>${String(rows.length)} leituras · ${String(withCover)} com capa · ${String(withSynopsis)} com sinopse</p>
<table>${rows.map(rowHtml).join('\n')}</table>`;
}

async function main() {
  const [outDir = 'lookup-eval', only] = process.argv.slice(2);
  const readings = only ? only.split('|').map((r) => r.trim()) : READINGS;
  const apiKey = process.env.GOOGLE_BOOKS_KEY ?? null;
  mkdirSync(outDir, { recursive: true });
  const rows: Row[] = [];
  for (const reading of readings) {
    const started = Date.now();
    const result = await lookupBook(reading, {
      googleBooksApiKey: apiKey,
      measure,
      fetcher,
      timeoutMs: 10000,
    });
    rows.push({ reading, ms: Date.now() - started, result });
    const top = result.covers[0];
    print(
      `${reading.padEnd(48)} | ${(result.work?.title ?? '—').slice(0, 40).padEnd(40)} | capa: ${top ? top.label.slice(0, 34) : '—'} | sinopse: ${result.synopses[0]?.label ?? '—'}`,
    );
    await pause(1200);
  }
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(rows, null, 1));
  writeFileSync(join(outDir, 'report.html'), reportHtml(rows));
  print(`\n${join(outDir, 'report.html')}`);
}

await main();
