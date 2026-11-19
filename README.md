# Clube do Livro

Site de um clube de leitura entre amigos: indicações anônimas, votação secreta com primeira e
segunda opção, a leitura do momento e o histórico de tudo o que o clube já leu.

Roda no GitHub Pages, com o Firebase (login e banco) no plano gratuito. O passo a passo para
colocar no ar está em [`docs/CONFIGURACAO.md`](docs/CONFIGURACAO.md).

## O que o site faz

- **Entrada só para o clube.** Login com Google ou por link no email. Só entram os emails da
  lista, e o aparelho continua conectado até a pessoa sair.
- **Indicação.** Cada membro indica uma leitura (livro, mangá, quadrinho, o que for) ou passa a
  vez (até 16 leituras por rodada). Pelo título e autor, o site busca capas e sinopses nos sites
  das editoras, no Google Livros, no Open Library, no AniList e na Wikipédia, sem nenhum servidor
  próprio. Quem indica alterna entre as sinopses encontradas, inteiras e em qualquer idioma
  (português primeiro), ou cola a da contracapa. Toda capa e toda sinopse encontrada guardam o
  link de onde vieram; a indicação não se perde ao trocar de aba. As
  indicações ficam escondidas até todos responderem e quem indicou nunca aparece.
  Ninguém é barrado por indicar o mesmo livro que outra pessoa: a conferência resolve depois.
- **Conferência.** Quando todos respondem, a lista se abre para todos e o site procura o mesmo
  livro, do mesmo autor, indicado mais de uma vez, mesmo em outra tradução ou edição ("Os
  Miseráveis" e "Les Misérables"); com o Gemini, se configurado. Volumes de uma série
  ("Mercenários 1" e "2") e livros diferentes da mesma franquia ("Harry Potter e a Pedra
  Filosofal" e "o Cálice de Fogo") não contam. A conferência só aponta, marcando cada grupo como
  certeza ou dúvida; quem organiza valida cada um. Ao juntar, fica a indicação de quem indicou
  primeiro, que vota normalmente; quem indicou depois tem a indicação anulada e já vota nesse
  livro em 1ª opção, sobrando só a 2ª. Quem organiza também pode manter separadas ou liberar
  alguém para trocar a indicação. Os outros membros só veem que houve um conflito.
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
- **Indicações:** não guardam quem indicou. Até todos responderem, cada pessoa lê só a própria;
  nem quem organiza vê as outras. A única exceção é a conferência: quem organiza pode ver quem
  indicou as leituras marcadas como repetidas (e só essas, no máximo três grupos pequenos),
  para conversar com essas pessoas. As regras limitam quantas leituras dá para marcar na rodada
  inteira: um par, ou até metade da lista.
- **Votos:** cada cédula cria um recibo vazio (diz só _que_ a pessoa votou) e soma numa
  contagem que ninguém lê até a votação fechar. Nada liga uma pessoa ao voto dela.
- **Uma pessoa, uma conta:** cada email da lista fica preso à primeira conta que entrou com
  ele, então ninguém vota duas vezes criando outra conta.
- **Respostas, votos e marcas de leitura:** valem uma vez só e não podem ser editados nem
  apagados, nem por quem organiza. A única troca possível: se quem organiza libera uma
  indicação repetida, ela sai da lista e só quem indicou pode responder de novo.
- **Vencedor:** precisa seguir a regra do clube, e o servidor confere.
- **Sorteio:** não é escolhido por ninguém. Os empatados ficam na ordem da cédula, e um
  número pseudoaleatório, gerado a partir do instante em que a votação fechou, escolhe o
  vencedor; as regras refazem a conta antes de aceitar.

O que as regras não conseguem impedir, e por quê:

- **Quem organiza é de confiança para a lista e para os conflitos:** essa pessoa pode incluir
  emails, liberar o lugar de alguém (tirando o email e pondo de novo, o que deixa uma conta nova
  votar outra vez na rodada) e decidir que duas leituras são a mesma. Ainda assim, as regras
  limitam quantas leituras dá para marcar por rodada e não deixam abrir a votação antes de quem
  foi liberado responder (ou de passarem 3 dias).
- **A conferência roda no navegador:** um app adulterado pode pular a conferência (as repetidas
  vão separadas para a cédula) ou marcar leituras à toa, dentro do limite da rodada, o que mostra
  a quem organiza quem as indicou. Juntar leituras, só quem organiza pode.
- **Contagem parcial:** ao votar, um app adulterado pode tentar valores até acertar a contagem
  atual das leituras em que votou. Fica sabendo só disso, só uma vez, e o voto vale normalmente.
- **Ordem de chegada:** a lista guarda as indicações na ordem em que chegaram, então quem
  acompanha o site ao vivo pode tentar adivinhar quem indicou o quê pelo horário.

## Desenvolvimento

Requer Node 24 (veja `.nvmrc`).

```sh
npm install
npm run dev:demo     # clube de exemplo em memória, sem Firebase
npm run dev:emulator # o site de verdade nos emuladores locais, sem o projeto real (requer Java 21)
npm run dev          # com o seu Firebase (.env.local; veja docs/CONFIGURACAO.md)
npm run check        # tipos, lint, formatação e testes
npm run test:rules   # regras do Firestore no emulador (requer Java 21)
npm run eval:duplicates  # mede a conferência no Gemini (com GEMINI_API_KEY)
npm run illustrations  # regenera as ilustrações em src/assets/illustrations
```

No demo, a barra do topo troca de membro e de etapa (Indicações, Votação, Lendo), para
experimentar cada tela.

`dev:emulator` roda o código do site publicado contra os emuladores do Firebase: login, banco
e as mesmas `firestore.rules`, sem tocar no projeto real nem gastar cota. Ele não usa App
Check, Gemini nem a chave do Google Books (sem ela, o Google Livros fica fora da busca). A lista começa com `organizador@exemplo.com`
(organizador), `ana@`, `bia@` e `caio@exemplo.com`. Para entrar, use "Entrar com Google" e,
no popup do emulador, "Add new account" com um desses emails. Os dados ficam em
`.emulator-data/` ao sair com Ctrl+C; apague a pasta para recomeçar. O painel dos emuladores
fica em http://127.0.0.1:4000.

## Como o código está organizado

```text
src/
  domain/      regras do clube, sem dependências: votação, apuração, sorteio, fluxo do ciclo
  services/    a interface do backend e suas implementações
    firebase/  a de verdade (Auth + Firestore)
    demo/      a de exemplo, em memória, que aplica as mesmas regras
    lookup/    busca de capas e sinopses (editoras, catálogos, Wikipédia) e a escolha da melhor
    duplicates/ conferência de indicações repetidas (prompt do Gemini e versão do demo)
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
