import { describe, expect, it } from 'vitest';

import { fitToLimit, toPlainText } from './text';

describe('toPlainText', () => {
  it('turns catalog HTML into paragraphs', () => {
    expect(toPlainText('<p>Um <i>romance</i> &amp; mais.</p><p>Outro&nbsp;parágrafo.</p>')).toBe(
      'Um romance & mais.\n\nOutro parágrafo.',
    );
    expect(toPlainText('Linha um<br>Linha dois<br/><br />Fim &#8212; &#x2014;')).toBe(
      'Linha um\nLinha dois\n\nFim — —',
    );
  });

  it('drops credits, extras and Markdown', () => {
    expect(toPlainText('Guts luta.<br><br>(Source: Dark Horse)')).toBe('Guts luta.');
    expect(
      toPlainText('A **saga** de [Arthur](https://x.org).\n----------\nContains: vol. 1'),
    ).toBe('A saga de Arthur.');
  });

  it('cuts long texts at the last full sentence that fits', () => {
    const text = `${'Frase curta. '.repeat(10)}Uma última frase que não cabe.`;
    expect(fitToLimit(text, 140)).toBe('Frase curta. '.repeat(10).trimEnd());
    expect(fitToLimit('x'.repeat(50), 20)).toBe(`${'x'.repeat(19)}…`);
  });
});
