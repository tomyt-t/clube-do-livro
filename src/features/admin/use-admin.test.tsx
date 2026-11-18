import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createDemoBackend, createDemoState } from '@/services/demo';
import { renderAsMember } from '@/test/render';

import { useMemberCountSync } from './use-admin';

function Sync({ listed, counted }: { listed: number | null; counted: number | null }) {
  useMemberCountSync(listed, counted);
  return null;
}

function renderSync(listed: number | null, counted: number | null) {
  const backend = createDemoBackend({ state: createDemoState(new Date(), 'voting') });
  const setMemberCount = vi.spyOn(backend.admin, 'setMemberCount').mockResolvedValue();
  renderAsMember(<Sync listed={listed} counted={counted} />, 'marina', { backend });
  return setMemberCount;
}

describe('useMemberCountSync', () => {
  it('never takes a partial list for the club: a sharp drop could close a vote early', async () => {
    // What happened live: a cached list with only the organizer's own entry.
    const setMemberCount = renderSync(1, 14);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(setMemberCount).not.toHaveBeenCalled();
  });

  it('follows one removal', async () => {
    const setMemberCount = renderSync(13, 14);
    await waitFor(() => {
      expect(setMemberCount).toHaveBeenCalledWith(13);
    });
  });

  it('follows any addition', async () => {
    const setMemberCount = renderSync(16, 14);
    await waitFor(() => {
      expect(setMemberCount).toHaveBeenCalledWith(16);
    });
  });

  it('leaves a matching count alone', async () => {
    const setMemberCount = renderSync(14, 14);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(setMemberCount).not.toHaveBeenCalled();
  });
});
