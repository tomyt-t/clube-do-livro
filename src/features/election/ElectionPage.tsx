import { EmptyState } from '@/ui/EmptyState';
import { Page } from '@/ui/Page';

export function ElectionPage() {
  return (
    <Page title="Votação">
      <EmptyState title="Nenhuma votação aberta">
        Quando o organizador abrir as indicações, é por aqui que você indica uma leitura.
      </EmptyState>
    </Page>
  );
}
