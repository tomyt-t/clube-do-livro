import { PATHS } from '@/app/paths';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Page } from '@/ui/Page';

export function ReadingPage() {
  return (
    <Page title="Lendo agora" hideTitle>
      <EmptyState
        title="Nenhuma leitura em andamento"
        action={
          <LinkButton to={PATHS.election} variant="secondary">
            Ir para a votação
          </LinkButton>
        }
      >
        Quando uma votação terminar, a leitura escolhida aparece aqui.
      </EmptyState>
    </Page>
  );
}
