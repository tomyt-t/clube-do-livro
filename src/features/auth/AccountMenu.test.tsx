import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderAsMember } from '@/test/render';

import { AccountMenu } from './AccountMenu';
import { monogram } from './monogram';

describe('AccountMenu', () => {
  it('opens with who is signed in and signs out', async () => {
    const { user } = renderAsMember(<AccountMenu />);
    const trigger = await screen.findByRole('button', { name: 'Conta de Marina' });
    expect(trigger).toHaveTextContent('M');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('marina@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Organizar o clube' })).toHaveAttribute(
      'href',
      '/organizar',
    );

    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('button', { name: 'Entrar com Google' })).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const { user } = renderAsMember(<AccountMenu />, 'rafa');
    const trigger = await screen.findByRole('button', { name: 'Conta de Rafa' });
    await user.click(trigger);
    expect(screen.queryByRole('link', { name: 'Organizar o clube' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('monogram', () => {
  it('uses the first letter, uppercased', () => {
    expect(monogram('júlia')).toBe('J');
    expect(monogram('  ')).toBe('?');
  });
});
