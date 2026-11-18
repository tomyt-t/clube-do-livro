import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('is a plain button by default, so it never submits forms by accident', () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('type', 'button');
  });

  it('blocks clicks and reports progress while busy', async () => {
    const onClick = vi.fn();
    render(
      <Button busy onClick={onClick}>
        Enviar
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Enviar' });
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
