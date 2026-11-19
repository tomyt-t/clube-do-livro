import { useId, useState } from 'react';

import type { SynopsisChoice } from '@/services/lookup';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { withHost } from '@/ui/link-host';
import { Spinner } from '@/ui/Spinner';
import { SynopsisText } from '@/ui/SynopsisText';
import { TextArea, TextField } from '@/ui/TextField';

import type { PickErrors, SynopsisPick } from './draft';
import styles from './SynopsisPicker.module.css';

type OwnPick = Extract<SynopsisPick, { kind: 'own' }>;

const BLANK: OwnPick = { kind: 'own', text: '', sourceUrl: '', from: null };

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="visually-hidden"> (abre em outra aba)</span>
    </a>
  );
}

interface PillProps {
  name: string;
  checked: boolean;
  label: string;
  onPick: () => void;
}

/** One source to read: a native radio drawn as a small tab. */
function Pill({ name, checked, label, onPick }: PillProps) {
  return (
    <label className={cx(styles.pill, checked && styles.on)}>
      <input
        type="radio"
        name={name}
        className="visually-hidden"
        checked={checked}
        onChange={onPick}
      />
      {label}
    </label>
  );
}

function Found({ option, onEdit }: { option: SynopsisChoice; onEdit: () => void }) {
  return (
    <div className={styles.found}>
      <div className={styles.text}>
        <SynopsisText text={option.text} />
      </div>
      <div className={styles.foot}>
        <p className={styles.credit}>
          <ExternalLink href={option.sourceUrl}>{withHost('Fonte', option.sourceUrl)}</ExternalLink>
        </p>
        <Button variant="quiet" onClick={onEdit}>
          Editar este texto
        </Button>
      </div>
    </div>
  );
}

function OwnText({
  pick,
  errors,
  onChange,
}: {
  pick: OwnPick;
  errors: PickErrors;
  onChange: (pick: OwnPick) => void;
}) {
  return (
    <div className={styles.own}>
      <TextArea
        label="Texto da sinopse"
        value={pick.text}
        rows={8}
        maxLength={2000}
        hint={pick.from ? `Editando o texto de: ${pick.from.label}.` : 'Cole ou escreva a sinopse.'}
        error={errors.synopsisText}
        onChange={(event) => {
          onChange({ ...pick, text: event.target.value });
        }}
      />
      <TextField
        label="Link de onde veio a sinopse"
        type="url"
        inputMode="url"
        value={pick.sourceUrl}
        autoComplete="off"
        placeholder="https://"
        hint="A página da editora, de uma livraria ou de onde veio o texto."
        error={errors.synopsisLink}
        onChange={(event) => {
          onChange({ ...pick, sourceUrl: event.target.value });
        }}
      />
    </div>
  );
}

/** Nothing to choose from: where to look, and the box to paste it. */
function NothingFound({ title }: { title: string }) {
  const search = `https://www.google.com/search?q=${encodeURIComponent(`${title} sinopse`)}`;
  return (
    <p className={styles.status}>
      Não encontramos uma sinopse. Cole a da contracapa ou do site da editora, com o link, ou siga
      sem. <ExternalLink href={search}>Procurar no Google</ExternalLink>
    </p>
  );
}

/** Searching, nothing found, or the note that the nomination goes without one. */
function Status({
  options,
  pick,
  title,
}: {
  options: readonly SynopsisChoice[] | null;
  pick: SynopsisPick;
  title: string;
}) {
  if (options === null) {
    return (
      <p className={styles.status} role="status">
        <Spinner /> Buscando sinopses…
      </p>
    );
  }
  if (options.length === 0) return pick.kind === 'own' ? null : <NothingFound title={title} />;
  return pick.kind === 'none' ? (
    <p className={styles.status}>A indicação vai sem sinopse.</p>
  ) : null;
}

interface SynopsisPickerProps {
  /** Null while the search runs. */
  options: readonly SynopsisChoice[] | null;
  pick: SynopsisPick;
  /** Shown once the member tries to send. */
  errors: PickErrors;
  /** What was typed, for the "search for it" link. */
  title: string;
  onPick: (pick: SynopsisPick) => void;
}

/**
 * Every synopsis found, one at a time: the tabs switch between sources,
 * and any text can be edited or replaced, always with the page it came
 * from.
 */
export function SynopsisPicker({ options, pick, errors, title, onPick }: SynopsisPickerProps) {
  const name = useId();
  // What the member wrote survives looking at the other sources and back.
  const [own, setOwn] = useState<OwnPick | null>(null);
  const found = options ?? [];

  const write = (next: OwnPick) => {
    setOwn(next);
    onPick(next);
  };

  return (
    <fieldset className={styles.picker}>
      <legend className={styles.legend}>Sinopse</legend>
      <Status options={options} pick={pick} title={title} />
      <div className={styles.pills}>
        {found.map((option) => (
          <Pill
            key={`${option.sourceUrl} ${option.text.slice(0, 40)}`}
            name={name}
            checked={pick.kind === 'found' && pick.option === option}
            label={option.label}
            onPick={() => {
              onPick({ kind: 'found', option });
            }}
          />
        ))}
        <Pill
          name={name}
          checked={pick.kind === 'own'}
          label="Escrever ou colar"
          onPick={() => {
            write(own ?? BLANK);
          }}
        />
        <Pill
          name={name}
          checked={pick.kind === 'none'}
          label="Sem sinopse"
          onPick={() => {
            onPick({ kind: 'none' });
          }}
        />
      </div>
      {pick.kind === 'found' && (
        <Found
          option={pick.option}
          onEdit={() => {
            const { text, sourceUrl } = pick.option;
            write({ kind: 'own', text, sourceUrl, from: pick.option });
          }}
        />
      )}
      {pick.kind === 'own' && <OwnText pick={pick} errors={errors} onChange={write} />}
    </fieldset>
  );
}
