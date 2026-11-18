import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog';

function renderDialog(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Tem certeza de que não quer indicar nesta rodada?"
      confirmLabel="Não quero indicar"
      tone="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    >
      Depois de enviar, não dá para mudar.
    </ConfirmDialog>,
  );
  return { onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
  it('asks the question with its explanation', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', {
      name: 'Tem certeza de que não quer indicar nesta rodada?',
    });
    expect(dialog).toHaveAccessibleDescription('Depois de enviar, não dá para mudar.');
  });

  it('confirms or goes back', async () => {
    const { onConfirm, onCancel } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Não quero indicar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('treats Esc as going back, unless an action is running', () => {
    const { onCancel } = renderDialog();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('blocks both choices while confirming', () => {
    renderDialog({ busy: true });
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Não quero indicar' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });
});
