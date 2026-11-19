import { useId, useState, type ReactNode } from 'react';

import type { CoverChoice } from '@/services/lookup';
import { cx } from '@/ui/cx';
import { withHost } from '@/ui/link-host';
import { Spinner } from '@/ui/Spinner';
import { TextField } from '@/ui/TextField';

import styles from './CoverPicker.module.css';
import type { CoverPick } from './draft';
import { resizeCover } from './resize-cover';

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

function SearchStatus({ covers }: { covers: readonly CoverChoice[] | null }) {
  if (covers === null) {
    return (
      <p className={styles.status} role="status">
        <Spinner /> Buscando capas…
      </p>
    );
  }
  return covers.length === 0 ? (
    <p className={styles.status}>Nenhuma capa encontrada. Envie uma imagem ou siga sem capa.</p>
  ) : null;
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

/** Where the chosen cover comes from: the catalog's page, or a link the member gives. */
function CoverSource({
  pick,
  error,
  onPick,
}: {
  pick: CoverPick;
  error: string | null;
  onPick: (pick: CoverPick) => void;
}) {
  if (pick.kind === 'none') {
    return <p className={styles.caption}>Sem capa: o título aparece no lugar.</p>;
  }
  if (pick.kind === 'found') {
    return (
      <p className={styles.caption}>
        {pick.cover.label}.{' '}
        <a href={pick.cover.sourceUrl} target="_blank" rel="noopener noreferrer">
          {withHost('Ver a fonte', pick.cover.sourceUrl)}
          <span className="visually-hidden"> (abre em outra aba)</span>
        </a>
      </p>
    );
  }
  return (
    <TextField
      label="Link da página de onde veio a imagem"
      type="url"
      inputMode="url"
      value={pick.sourceUrl}
      autoComplete="off"
      placeholder="https://"
      hint="A página da editora, de uma livraria ou de onde você tirou a capa."
      error={error}
      onChange={(event) => {
        onPick({ ...pick, sourceUrl: event.target.value });
      }}
    />
  );
}

interface CoverPickerProps {
  /** Null while the search runs. */
  covers: readonly CoverChoice[] | null;
  pick: CoverPick;
  /** Shown once the member tries to send. */
  sourceError: string | null;
  onPick: (pick: CoverPick) => void;
}

export function CoverPicker({ covers, pick, sourceError, onPick }: CoverPickerProps) {
  const name = useId();
  // A restored pick (after a trip to another tab) brings its image back.
  const [upload, setUpload] = useState<string | null>(pick.kind === 'upload' ? pick.dataUrl : null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pickedUrl = pick.kind === 'found' ? pick.cover.url : null;
  // The link typed for the image survives switching away and back.
  const [uploadSource, setUploadSource] = useState(pick.kind === 'upload' ? pick.sourceUrl : '');

  const pickUpload = (dataUrl: string) => {
    onPick({ kind: 'upload', dataUrl, sourceUrl: uploadSource });
  };

  return (
    <fieldset className={styles.picker}>
      <legend className={styles.legend}>Capa</legend>
      <SearchStatus covers={covers} />
      <div className={styles.strip}>
        {(covers ?? []).map((cover) => (
          <Tile
            key={cover.url}
            name={name}
            checked={pickedUrl === cover.url}
            onPick={() => {
              onPick({ kind: 'found', cover });
            }}
            label={cover.label}
          >
            <img src={cover.url} alt="" referrerPolicy="no-referrer" loading="lazy" />
          </Tile>
        ))}
        {upload && (
          <Tile
            name={name}
            checked={pick.kind === 'upload'}
            onPick={() => {
              pickUpload(upload);
            }}
            label="Sua imagem"
          >
            <img src={upload} alt="" />
          </Tile>
        )}
        <UploadTile
          onUpload={(dataUrl) => {
            setUpload(dataUrl);
            pickUpload(dataUrl);
          }}
          onError={setUploadError}
        />
        <Tile
          name={name}
          checked={pick.kind === 'none'}
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
      <CoverSource
        pick={pick}
        error={sourceError}
        onPick={(next) => {
          if (next.kind === 'upload') setUploadSource(next.sourceUrl);
          onPick(next);
        }}
      />
    </fieldset>
  );
}
