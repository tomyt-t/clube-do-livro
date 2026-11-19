import { useId, useState } from 'react';

import { useBackend } from '@/app/services';
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

type Translation = 'idle' | 'busy' | 'failed';

/** For a text in another language: Gemini's translation, to check in the box. */
interface TranslateProps {
  option: SynopsisChoice;
  /** As the member typed it, for the translation to name the book that way. */
  title: string;
  onDone: (text: string) => void;
}

function Translate({ option, title, onDone }: TranslateProps) {
  const { translator } = useBackend();
  const [state, setState] = useState<Translation>('idle');
  if (!translator || !option.foreign) return null;
  return (
    <>
      <Button
        variant="quiet"
        disabled={state === 'busy'}
        onClick={() => {
          setState('busy');
          void translator.translate(option.text, title).then(
            (text) => {
              setState('idle');
              onDone(text);
            },
            () => {
              setState('failed');
            },
          );
        }}
      >
        {state === 'busy' ? 'Traduzindo…' : 'Traduzir para o português'}
      </Button>
      {state === 'failed' && (
        <p className={styles.status} role="alert">
          Não foi possível traduzir agora. O texto original continua aqui.
        </p>
      )}
    </>
  );
}

interface FoundProps {
  option: SynopsisChoice;
  title: string;
  onEdit: () => void;
  onTranslated: (text: string) => void;
}

function Found({ option, title, onEdit, onTranslated }: FoundProps) {
  return (
    <div className={styles.found}>
      <div className={styles.text}>
        <SynopsisText text={option.text} />
      </div>
      <div className={styles.foot}>
        <p className={styles.credit}>
          <ExternalLink href={option.sourceUrl}>{withHost('Fonte', option.sourceUrl)}</ExternalLink>
        </p>
        <Translate
          key={option.sourceUrl + option.text.slice(0, 40)}
          option={option}
          title={title}
          onDone={onTranslated}
        />
        <Button variant="quiet" onClick={onEdit}>
          Editar este texto
        </Button>
      </div>
    </div>
  );
}

function hintFor(pick: OwnSynopsis): string {
  if (pick.from && pick.translated) {
    return `Tradução automática do texto de: ${pick.from.label}. Confira antes de enviar.`;
  }
  if (pick.from) return `Editando o texto de: ${pick.from.label}.`;
  return 'Cole a sinopse da contracapa ou do site da editora. Em branco, a indicação vai sem sinopse.';
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
      hint={hintFor(pick)}
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
          title={title}
          onEdit={() => {
            write({ kind: 'own', text: pick.option.text, from: pick.option });
          }}
          onTranslated={(text) => {
            write({ kind: 'own', text, from: pick.option, translated: true });
          }}
        />
      ) : (
        <PasteBox pick={pick} error={error} onChange={write} />
      )}
    </fieldset>
  );
}
