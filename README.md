# Clube do Livro

Site de um clube de leitura entre amigos: indicações anônimas, votação secreta com primeira e
segunda opção, a leitura do momento e o histórico de tudo o que o clube já leu.

Roda no GitHub Pages, com o Firebase (login e banco) no plano gratuito. O passo a passo para
colocar no ar está em [`docs/CONFIGURACAO.md`](docs/CONFIGURACAO.md).

## O que o site faz

- **Entrada só para o clube.** Login com Google ou por link no email. Só entram os emails da
  lista, e o aparelho continua conectado até a pessoa sair.
- **Indicação.** Cada membro indica uma leitura (livro, mangá, quadrinho, o que for) ou passa a
  vez. A capa e a sinopse vêm dos catálogos (Open Library, AniList, Google Livros) ou do link da
  Wikipédia. Quem indicou nunca aparece.
- **Votação.** Em lista ou em cartas, cada um escolhe uma 1ª e uma 2ª opção, nunca a própria
  indicação. Vence quem tiver mais votos. Empatou, vence quem tiver mais votos de 1ª opção. Se
  ainda empatar, há um sorteio que qualquer um pode conferir.
- **Leitura.** Capa, sinopse e o botão **Acabei de ler!**.
- **O clube anda sozinho.** A votação abre quando todos responderam, o resultado sai quando
  todos votaram, e a próxima rodada começa quando todos terminaram de ler. Quem organiza pode
  avançar manualmente se alguém sumir.
- **Histórico.** A estante com as leituras passadas e o gráfico de cada votação.

## Privacidade e segurança

Toda a segurança está em [`firestore.rules`](firestore.rules), com testes de ataque em
[`tests/rules`](tests/rules):

- **Emails da lista:** ninguém além de quem organiza consegue ler. O perfil de cada membro tem
  só nome e foto.
- **Indicações:** não guardam quem indicou. Só a própria pessoa lê a própria resposta.
- **Votos:** cada cédula cria um recibo vazio (diz só _que_ a pessoa votou) e soma numa
  contagem que ninguém lê até a votação fechar. Nada liga uma pessoa ao voto dela.
- **Respostas, votos e marcas de leitura:** valem uma vez só e não podem ser editados nem
  apagados, nem por quem organiza.
- **Vencedor:** precisa seguir a regra do clube, e o servidor confere.
- **Sorteio:** não é escolhido por ninguém. Os empatados ficam na ordem da cédula, e um
  número pseudoaleatório, gerado a partir do instante em que a votação fechou, escolhe o
  vencedor; as regras refazem a conta antes de aceitar.

## Desenvolvimento

Requer Node 24 (veja `.nvmrc`).

```sh
npm install
npm run dev:demo     # clube de exemplo em memória, sem Firebase
npm run dev          # com o seu Firebase (.env.local; veja docs/CONFIGURACAO.md)
npm run check        # tipos, lint, formatação e testes
npm run test:rules   # regras do Firestore no emulador (requer Java 21)
npm run illustrations  # regenera as ilustrações em src/assets/illustrations
```

No demo, a barra do topo troca de membro e de etapa (Indicações, Votação, Lendo), para
experimentar cada tela.

## Como o código está organizado

```text
src/
  domain/      regras do clube, sem dependências: votação, apuração, sorteio, fluxo do ciclo
  services/    a interface do backend e suas implementações
    firebase/  a de verdade (Auth + Firestore)
    demo/      a de exemplo, em memória, que aplica as mesmas regras
    covers/    busca de capas nos catálogos
    synopsis/  sinopses do catálogo escolhido ou da Wikipédia
  features/    as telas: login, leitura, votação, histórico, organizar
  ui/          componentes e estilos compartilhados
tests/rules/   testes das regras de segurança contra o emulador
```

As telas falam só com a interface em `services/backend.ts`. Por isso os testes de interface
rodam contra o backend de exemplo, sem Firebase.

## Qualidade

- TypeScript estrito.
- ESLint com regras de complexidade alinhadas ao [CodeScene](https://codescene.com) (extensão
  recomendada em `.vscode`).
- Prettier e Husky.
- Testes com Vitest e Testing Library.
- O CI do GitHub roda tudo isso, mais as regras no emulador, a cada push.
