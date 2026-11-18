import { useEffect, useId, useMemo, useState } from 'react';

import { useBackend } from '@/app/services';
import { splitTitle } from '@/domain/book';
import { findActiveElection } from '@/domain/cycle';
import {
  canLetGo,
  conflictIds,
  mergeGroup,
  nominatorsOf,
  withoutGroup,
  type ConflictGroup,
} from '@/domain/review';
import type { Cycle, MemberId, NominationId } from '@/domain/types';
import { useCycles, useMemberProfiles, useNominations } from '@/features/club/use-club';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { joinNames } from '@/ui/format';
import { Notice } from '@/ui/Notice';

import styles from './AdminPage.module.css';
import { useAction } from './use-admin';

/** An action waiting for the organizer to confirm it. */
interface Pending {
  title: string;
  body: string;
  label: string;
  run: () => Promise<unknown>;
}

/** Who nominated each flagged reading; the rules show the organizer nothing else. */
function useNominators(cycle: Cycle, ids: readonly NominationId[]) {
  const { admin } = useBackend();
  const [found, setFound] = useState<Record<NominationId, MemberId[]>>({});
  const key = ids.join();
  useEffect(() => {
    let live = true;
    admin
      .findNominators(cycle.id, key ? key.split(',') : [])
      .then((result) => {
        if (live) setFound(result);
      })
      .catch(() => {
        if (live) setFound({});
      });
    return () => {
      live = false;
    };
  }, [admin, cycle.id, key]);
  return found;
}

interface GroupProps {
  group: ConflictGroup;
  titleOf: (id: NominationId) => string;
  namesOf: (id: NominationId) => string;
  /** Null when the group cannot be merged; same for letting a merged reading go. */
  onMerge: (() => void) | null;
  onDismiss: () => void;
  onUnlock: (id: NominationId) => (() => void) | null;
}

function Group({ group, titleOf, namesOf, onMerge, onDismiss, onUnlock }: GroupProps) {
  return (
    <div className={styles.conflict}>
      <p className={styles.detail}>{group.reason || 'Parecem a mesma leitura.'}</p>
      <ul className={styles.members}>
        {group.ids.map((id) => (
          <li key={id} className={styles.member}>
            <span className={styles.email}>
              <b>{titleOf(id)}</b> · indicada por {namesOf(id)}
            </span>
            <UnlockButton onUnlock={onUnlock(id)} />
          </li>
        ))}
      </ul>
      <div className={styles.addActions}>
        {onMerge && (
          <Button compact onClick={onMerge}>
            Juntar numa só
          </Button>
        )}
        <Button variant="quiet" compact onClick={onDismiss}>
          Não são a mesma
        </Button>
      </div>
    </div>
  );
}

function UnlockButton({ onUnlock }: { onUnlock: (() => void) | null }) {
  if (!onUnlock) return null;
  return (
    <Button variant="quiet" compact onClick={onUnlock}>
      Liberar para trocar
    </Button>
  );
}

function useReviewNames(cycle: Cycle, groups: readonly ConflictGroup[]) {
  const nominations = useNominations(cycle.id);
  const profiles = useMemberProfiles();
  const nominators = useNominators(cycle, conflictIds(groups));
  return useMemo(() => {
    const books = nominations.status === 'ready' ? nominations.value : [];
    const people = profiles.status === 'ready' ? profiles.value : [];
    const titleOf = (id: NominationId) =>
      splitTitle(books.find((n) => n.id === id)?.book.title ?? 'Leitura indicada').title;
    const nameOf = (uid: MemberId) => people.find((p) => p.uid === uid)?.name ?? 'alguém';
    const uidsOf = (id: NominationId) => nominators[id] ?? [];
    const namesOf = (id: NominationId) => joinNames(uidsOf(id).map(nameOf)) || 'alguém';
    return { titleOf, nameOf, uidsOf, namesOf };
  }, [nominations, profiles, nominators]);
}

/** The flagged groups of one review, and the three ways to sort each out. */
function Conflicts({ cycle, groups }: { cycle: Cycle; groups: readonly ConflictGroup[] }) {
  const { admin } = useBackend();
  const names = useReviewNames(cycle, groups);
  const [pending, setPending] = useState<Pending | null>(null);

  const merge = (index: number, group: ConflictGroup) => {
    const merged = mergeGroup(cycle.merged, group.ids, cycle.nominationIds);
    if (!merged) return;
    const kept = Object.values(merged).find((id) => group.ids.includes(id)) ?? '';
    setPending({
      title: 'Juntar numa só leitura?',
      body: `${joinNames(group.ids.map((id) => `“${names.titleOf(id)}”`))} viram uma opção só na cédula. Ela já começa com ${String(nominatorsOf(kept, merged))} votos de 1ª opção, um de cada pessoa que indicou, e essas pessoas votam só na 2ª opção.`,
      label: 'Juntar',
      run: () =>
        admin.updateReview({ cycleId: cycle.id, groups: withoutGroup(groups, index), merged }),
    });
  };

  const dismiss = (index: number) => {
    setPending({
      title: 'Não são a mesma leitura?',
      body: 'Elas entram separadas na cédula.',
      label: 'Manter separadas',
      run: () =>
        admin.updateReview({
          cycleId: cycle.id,
          groups: withoutGroup(groups, index),
          merged: cycle.merged,
        }),
    });
  };

  const unlock = (id: NominationId) => {
    const [uid] = names.uidsOf(id);
    const who = uid ? names.nameOf(uid) : 'quem indicou';
    setPending({
      title: `Liberar ${who} para trocar?`,
      body: `“${names.titleOf(id)}” sai da lista e ${who} indica de novo, agora vendo as outras. A votação espera essa nova resposta.`,
      label: 'Liberar',
      run: () => admin.reopenNominations({ cycleId: cycle.id, nominationIds: [id] }),
    });
  };

  return (
    <>
      {groups.map((group, index) => (
        <Group
          key={group.ids.join()}
          group={group}
          titleOf={names.titleOf}
          namesOf={names.namesOf}
          onMerge={
            mergeGroup(cycle.merged, group.ids, cycle.nominationIds)
              ? () => {
                  merge(index, group);
                }
              : null
          }
          onDismiss={() => {
            dismiss(index);
          }}
          onUnlock={(id) =>
            canLetGo(id, cycle.merged)
              ? () => {
                  unlock(id);
                }
              : null
          }
        />
      ))}
      <ConfirmPending
        pending={pending}
        onClose={() => {
          setPending(null);
        }}
      />
    </>
  );
}

/** Asks before the action, runs it, and stays open with the error if it fails. */
function ConfirmPending({ pending, onClose }: { pending: Pending | null; onClose: () => void }) {
  const action = useAction();
  return (
    <ConfirmDialog
      open={pending !== null}
      title={pending?.title ?? ''}
      confirmLabel={pending?.label ?? ''}
      busy={action.busy}
      onConfirm={() => {
        if (pending) {
          void action.run(pending.run).then((done) => {
            if (done) onClose();
          });
        }
      }}
      onCancel={() => {
        action.reset();
        onClose();
      }}
    >
      <p>{pending?.body}</p>
      {action.error && <Notice tone="error">{action.error}</Notice>}
    </ConfirmDialog>
  );
}

/**
 * Readings the check flagged as nominated twice. Only the organizer sees who
 * nominated them, to talk it over; everyone else only sees that there was a
 * conflict.
 */
export function ConflictsPanel() {
  const cycles = useCycles();
  const headingId = useId();
  const election = cycles.status === 'ready' ? findActiveElection(cycles.value) : null;
  const groups = election?.status === 'nominating' ? (election.review?.conflicts ?? []) : [];
  if (!election || groups.length === 0) return null;

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.label}>
        Conferência
      </h2>
      <div className={styles.line}>
        <div>
          <p className={styles.headline}>Indicações que parecem repetidas</p>
          <p className={styles.detail}>
            Só você vê quem indicou estas leituras. Converse com essas pessoas e escolha o que
            fazer; a votação abre quando não sobrar nenhuma.
          </p>
        </div>
      </div>
      <Conflicts cycle={election} groups={groups} />
    </section>
  );
}
