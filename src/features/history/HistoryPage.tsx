import { EmptyState } from '@/ui/EmptyState';
import { Page } from '@/ui/Page';

export function HistoryPage() {
  return (
    <Page title="Histórico" width="wide">
      <EmptyState title="Nada no histórico ainda">
        As leituras concluídas e o resultado de cada votação ficam guardados aqui.
      </EmptyState>
    </Page>
  );
}
