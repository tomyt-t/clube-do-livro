import { describe, expect, it } from 'vitest';

import { makeCycle } from '@/test/factories';

import {
  electionStep,
  findActiveElection,
  findCurrentReading,
  findUpcoming,
  finishedCycles,
  isPastDeadline,
  nextCycleNumber,
  statusAfterDecision,
} from './cycle';

const finishedOne = makeCycle({ number: 1, status: 'finished' });
const finishedTwo = makeCycle({ number: 2, status: 'finished' });
const reading = makeCycle({ number: 3, status: 'reading' });
const voting = makeCycle({ number: 4, status: 'voting' });

describe('cycle selectors', () => {
  const cycles = [finishedOne, reading, voting, finishedTwo];

  it('finds the active election', () => {
    expect(findActiveElection(cycles)).toBe(voting);
    expect(findActiveElection([finishedOne])).toBeNull();
  });

  it('treats a pending draw as part of the election', () => {
    const tiebreak = makeCycle({ number: 5, status: 'tiebreak' });
    expect(findActiveElection([tiebreak])).toBe(tiebreak);
  });

  it('finds the book being read and the one coming next', () => {
    const upcoming = makeCycle({ number: 5, status: 'upcoming' });
    expect(findCurrentReading(cycles)).toBe(reading);
    expect(findUpcoming([...cycles, upcoming])).toBe(upcoming);
  });

  it('lists finished cycles newest first', () => {
    expect(finishedCycles(cycles)).toEqual([finishedTwo, finishedOne]);
  });

  it('numbers the next cycle after the highest one', () => {
    expect(nextCycleNumber(cycles)).toBe(5);
    expect(nextCycleNumber([])).toBe(1);
  });
});

describe('statusAfterDecision', () => {
  it('starts reading right away when nothing is being read', () => {
    expect(statusAfterDecision([finishedOne])).toBe('reading');
  });

  it('queues the book when another one is being read', () => {
    expect(statusAfterDecision([reading])).toBe('upcoming');
  });
});

describe('electionStep', () => {
  it.each([
    ['nominating', 'nominations'],
    ['voting', 'voting'],
    ['tiebreak', 'result'],
    ['reading', 'result'],
  ] as const)('maps %s to %s', (status, step) => {
    expect(electionStep(status)).toBe(step);
  });
});

describe('isPastDeadline', () => {
  const now = new Date('2026-03-10T12:00:00Z');

  it('is never past an absent deadline', () => {
    expect(isPastDeadline(null, now)).toBe(false);
  });

  it('compares against the given moment', () => {
    expect(isPastDeadline(new Date('2026-03-10T11:59:59Z'), now)).toBe(true);
    expect(isPastDeadline(new Date('2026-03-10T12:00:01Z'), now)).toBe(false);
  });
});
