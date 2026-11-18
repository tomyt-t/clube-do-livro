import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConfigError } from '@/config/env';

import { Splash, StartupError } from './StartupScreens';

describe('startup screens', () => {
  it('announces loading with the club name', () => {
    render(<Splash clubName="Clube de Teste" />);
    expect(screen.getByRole('status', { name: 'Carregando' })).toHaveTextContent('Clube de Teste');
  });

  it('lists the missing configuration', () => {
    render(<StartupError error={new ConfigError(['VITE_FIREBASE_API_KEY'])} />);
    expect(screen.getByRole('alert')).toHaveTextContent('VITE_FIREBASE_API_KEY');
  });

  it('asks to reload on unexpected failures', () => {
    render(<StartupError error={new Error('boom')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Recarregue a página');
  });
});
