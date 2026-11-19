import { useId, useState } from 'react';

import type { SynopsisChoice } from '@/services/lookup';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { withHost } from '@/ui/link-host';
import { Spinner } from '@/ui/Spinner';
import { SynopsisText } from '@/ui/SynopsisText';
import { TextArea } from '@/ui/TextField';

import { PASTE, type OwnSynopsis, type SynopsisPick } from './draft';
import styles from './SynopsisPicker.module.css';

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

/** The box for a synopsis found elsewhere; left blank, the nomination goes without one. */
function PasteBox({
  pick,
  error,
  onChange,
}: {
  pick: OwnSynopsis;
  error: string | null;
  onChange: (pick: OwnSynopsis) => void;
}) {
  return (
    <TextArea
      label="Sinopse"
      value={pick.text}
      rows={8}
      maxLength={2000}
      hint={
        pick.from
          ? `Editando o texto de: ${pick.from.label}.`
          : 'Cole a sinopse da contracapa ou do site da editora. Em branco, a indicação vai sem sinopse.'
      }
      error={error}
      onChange={(event) => {
        onChange({ ...pick, text: event.target.value });
      }}
    />
  );
}

/** Nothing to choose from: where to look for one to paste. */
function NothingFound({ title }: { title: string }) {
  const search = `https://www.google.com/search?q=${encodeURIComponent(`${title} sinopse`)}`;
  return (
    <p className={styles.status}>
      Não encontramos uma sinopse. Procure a da editora ou da contracapa e cole abaixo.{' '}
      <ExternalLink href={search}>Procurar no Google</ExternalLink>
    </p>
  );
}

function Searching() {
  return (
    <p className={styles.status} role="status">
      <Spinner /> Buscando sinopses…
    </p>
  );
}

interface SourcesProps {
  options: readonly SynopsisChoice[];
  pick: SynopsisPick;
  onFound: (option: SynopsisChoice) => void;
  onPaste: () => void;
}

/** One tab per synopsis found, and one for pasting another. */
function Sources({ options, pick, onFound, onPaste }: SourcesProps) {
  const name = useId();
  return (
    <div className={styles.pills}>
      {options.map((option) => (
        <Pill
          key={`${option.sourceUrl} ${option.text.slice(0, 40)}`}
          name={name}
          checked={pick.kind === 'found' && pick.option === option}
          label={option.label}
          onPick={() => {
            onFound(option);
          }}
        />
      ))}
      <Pill name={name} checked={pick.kind === 'own'} label="Colar outra" onPick={onPaste} />
    </div>
  );
}

interface SynopsisPickerProps {
  /** Null while the search runs. */
  options: readonly SynopsisChoice[] | null;
  pick: SynopsisPick;
  /** Shown once the member tries to send. */
  error: string | null;
  /** What was typed, for the "search for it" link. */
  title: string;
  onPick: (pick: SynopsisPick) => void;
}

/**
 * Every synopsis found, one at a time: the tabs switch between sources,
 * and a found text can be edited. When none fits, or none was found, the
 * member pastes one from elsewhere; the club does not write its own.
 */
export function SynopsisPicker({ options, pick, error, title, onPick }: SynopsisPickerProps) {
  // What was pasted survives looking at the found ones and back.
  const [own, setOwn] = useState<OwnSynopsis>(pick.kind === 'own' ? pick : PASTE);

  const write = (next: OwnSynopsis) => {
    setOwn(next);
    onPick(next);
  };

  if (options === null) {
    return (
      <fieldset className={styles.picker}>
        <legend className={styles.legend}>Sinopse</legend>
        <Searching />
      </fieldset>
    );
  }

  return (
    <fieldset className={styles.picker}>
      <legend className={styles.legend}>Sinopse</legend>
      {options.length === 0 ? (
        <NothingFound title={title} />
      ) : (
        <Sources
          options={options}
          pick={pick}
          onFound={(option) => {
            onPick({ kind: 'found', option });
          }}
          onPaste={() => {
            write(own);
          }}
        />
      )}
      {pick.kind === 'found' ? (
        <Found
          option={pick.option}
          onEdit={() => {
            write({ kind: 'own', text: pick.option.text, from: pick.option });
          }}
        />
      ) : (
        <PasteBox pick={pick} error={error} onChange={write} />
      )}
    </fieldset>
  );
}
