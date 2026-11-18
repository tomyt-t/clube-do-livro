import { useId, useState, type ReactNode } from 'react';

import type { CoverOption } from '@/services/covers';
import { cx } from '@/ui/cx';
import { Spinner } from '@/ui/Spinner';

import styles from './CoverPicker.module.css';
import type { CoverChoice } from './draft';
import { resizeCover } from './resize-cover';
import type { CoverSearch } from './use-lookups';

const SOURCE_NAMES: Record<CoverOption['source'], string> = {
  'open-library': 'Open Library',
  'google-books': 'Google Livros',
  anilist: 'AniList',
};

interface TileProps {
  name: string;
  checked: boolean;
  onPick: () => void;
  label: string;
  children: ReactNode;
}

/** A native radio, drawn as a cover-sized tile. */
function Tile({ name, checked, onPick, label, children }: TileProps) {
  return (
    <label className={cx(styles.tile, checked && styles.checked)}>
      <input
        type="radio"
        name={name}
        className="visually-hidden"
        checked={checked}
        onChange={onPick}
        aria-label={label}
      />
      {children}
    </label>
  );
}

function SearchStatus({ covers }: { covers: CoverSearch }) {
  if (covers.status === 'loading') {
    return (
      <p className={styles.status} role="status">
        <Spinner /> Buscando capas…
      </p>
    );
  }
  const message = searchMessage(covers);
  return message && <p className={styles.status}>{message}</p>;
}

function searchMessage(covers: Exclude<CoverSearch, { status: 'loading' }>): string | null {
  if (covers.status === 'error') {
    return 'Não foi possível buscar capas agora. Envie uma imagem ou siga sem capa.';
  }
  if (covers.options.length > 0) return null;
  return 'Nenhuma capa encontrada. Envie uma imagem ou siga sem capa.';
}

function describeChoice(choice: CoverChoice): string {
  if (choice.kind === 'none') return 'Sem capa: o título aparece no lugar.';
  if (choice.kind === 'upload') return 'Sua imagem.';
  const { title, details, source } = choice.option;
  return [title, details, SOURCE_NAMES[source]].filter(Boolean).join(', ') + '.';
}

interface UploadTileProps {
  onUpload: (dataUrl: string) => void;
  onError: (message: string | null) => void;
}

function UploadTile({ onUpload, onError }: UploadTileProps) {
  const [busy, setBusy] = useState(false);

  const read = async (file: File) => {
    setBusy(true);
    onError(null);
    try {
      onUpload(await resizeCover(file));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não deu para usar essa imagem.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className={cx(styles.tile, styles.action)}>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="visually-hidden"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void read(file);
        }}
      />
      {busy ? <Spinner /> : <span aria-hidden="true">+</span>}
      Enviar imagem
    </label>
  );
}

interface CoverPickerProps {
  covers: CoverSearch;
  choice: CoverChoice;
  onPick: (choice: CoverChoice) => void;
}

export function CoverPicker({ covers, choice, onPick }: CoverPickerProps) {
  const name = useId();
  const [upload, setUpload] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const options = covers.status === 'ready' ? covers.options : [];
  const pickedId = choice.kind === 'catalog' ? choice.option.id : null;

  return (
    <fieldset className={styles.picker}>
      <legend className={styles.legend}>Capa</legend>
      <SearchStatus covers={covers} />
      <div className={styles.strip}>
        {options.map((option) => (
          <Tile
            key={option.id}
            name={name}
            checked={pickedId === option.id}
            onPick={() => {
              onPick({ kind: 'catalog', option });
            }}
            label={`${option.title}, ${option.details}`}
          >
            <img src={option.imageUrl} alt="" referrerPolicy="no-referrer" loading="lazy" />
          </Tile>
        ))}
        {upload && (
          <Tile
            name={name}
            checked={choice.kind === 'upload'}
            onPick={() => {
              onPick({ kind: 'upload', dataUrl: upload });
            }}
            label="Sua imagem"
          >
            <img src={upload} alt="" />
          </Tile>
        )}
        <UploadTile
          onUpload={(dataUrl) => {
            setUpload(dataUrl);
            onPick({ kind: 'upload', dataUrl });
          }}
          onError={setUploadError}
        />
        <Tile
          name={name}
          checked={choice.kind === 'none'}
          onPick={() => {
            onPick({ kind: 'none' });
          }}
          label="Sem capa"
        >
          <span className={styles.none}>Sem capa</span>
        </Tile>
      </div>
      {uploadError && (
        <p className={styles.error} role="alert">
          {uploadError}
        </p>
      )}
      <p className={styles.caption}>{describeChoice(choice)}</p>
    </fieldset>
  );
}
