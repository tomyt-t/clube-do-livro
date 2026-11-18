# Colocando o clube no ar

Passo a passo para publicar o site com um projeto Firebase seu. Leva uns 20 minutos e não
precisa de cartão: tudo cabe no plano gratuito (Spark) do Firebase e no GitHub Pages.

> Para só experimentar, sem configurar nada: `npm run dev:demo` abre um clube de mentira, com
> dados de exemplo, que volta ao início quando a página recarrega.

## 1. Criar o projeto no Firebase

1. Entre em <https://console.firebase.google.com> e clique em **Criar um projeto**.
2. Dê um nome (por exemplo, `clube-do-livro`). O Google Analytics não é usado; pode desligar.

## 2. Ligar o login

Em **Authentication → Primeiros passos**:

1. Aba **Método de login**:
   - Ative **Google**. Escolha o email de suporte e salve.
   - Ative **E-mail/senha** e, dentro dele, **Link do e-mail (login sem senha)**. A senha em si
     não é usada pelo site.
2. Aba **Configurações → Domínios autorizados**: adicione o domínio do site
   (`<seu-usuario>.github.io`, ou o seu domínio próprio) e **remova `localhost`**. Para testar
   no computador, use o modo demo ou um segundo projeto Firebase só para isso.
   - Ainda em **Configurações**, deixe ligada a **proteção contra enumeração de emails**. O
     provedor E-mail/senha precisa estar ativo para o link funcionar, então qualquer pessoa
     consegue criar uma conta com senha; quem impede essas contas de entrar são as regras, que
     exigem email verificado e na lista do clube.
3. (Opcional) Em **Templates → Verificação de e-mail / Login por link**, ajuste o texto do email
   que chega com o link. Ele sai de `noreply@<projeto>.firebaseapp.com`; avise o clube para
   olhar o spam na primeira vez.

## 3. Criar o banco

1. **Firestore Database → Criar banco de dados**.
2. Escolha **modo de produção** e a região `southamerica-east1 (São Paulo)`.

As regras de segurança do repositório (`firestore.rules`) substituem as padrão no passo 5.

## 4. Registrar o app da Web

1. **Configurações do projeto** (engrenagem) **→ Seus apps → Web** (`</>`).
2. Dê um apelido e registre. Não precisa do Firebase Hosting.
3. Guarde quatro valores do trecho `firebaseConfig`: `apiKey`, `authDomain`, `projectId` e
   `appId`.

Esses valores não são segredo: o navegador de qualquer visitante os recebe. Quem decide o que
cada pessoa pode ler ou escrever são as regras do Firestore. Mas a `apiKey` precisa servir **só**
para o Firebase:

4. No [Google Cloud Console](https://console.cloud.google.com), no mesmo projeto, abra **APIs e
   serviços → Credenciais → Browser key (auto created by Firebase)**:
   - **Restrições de aplicativo → Referenciadores HTTP**: `https://<seu-usuario>.github.io/*`
     (ou o seu domínio);
   - **Restrições de API**: só Identity Toolkit API, Token Service API, Cloud Firestore API,
     Firebase Installations API, Firebase App Check API e, se usar a conferência com o Gemini,
     Firebase AI Logic API. **Nunca** a Generative Language API: com ela, a chave pública do
     site viraria uma chave do Gemini.

**Endereço do site.** Todo site do GitHub Pages de uma mesma conta divide o endereço
`<seu-usuario>.github.io`, e com ele o armazenamento do navegador onde fica o login. Se a conta
tem (ou vai ter) outros sites no Pages, use um **domínio próprio** para o clube, ou publique de
uma conta ou organização só para ele.

## 5. Publicar as regras de segurança

No terminal, na pasta do projeto:

```sh
npx firebase login
npx firebase deploy --only firestore:rules --project <id-do-projeto>
```

Repita o segundo comando sempre que `firestore.rules` mudar. O CI testa as regras a cada push,
mas quem as publica é você.

## 6. Cadastrar você como quem organiza

O site só deixa entrar quem está na lista, e a primeira pessoa precisa ser criada à mão:

1. **Firestore Database → Iniciar coleção**, com o ID `allowlist`.
2. ID do documento: **o seu email, todo em minúsculas** (por exemplo, `maria@gmail.com`).
3. Um campo: `admin`, do tipo **booleano**, valor `true`.

Os outros membros você adiciona pelo próprio site, no passo 9.

Na primeira vez que alguém entra, o site grava em `uid` a conta usada, e daí em diante só essa
conta age por aquele email. Assim, ninguém vota duas vezes apagando a conta e entrando de novo.
Se alguém perder a conta de verdade, tire o email da lista e inclua de novo: a próxima conta que
entrar fica com o lugar (e pode responder de novo na rodada em andamento, então faça isso só
quando for preciso).

## 7. Configurar o GitHub

No repositório, em **Settings**:

1. **Pages → Build and deployment → Source: GitHub Actions**.
2. **Secrets and variables → Actions → aba Variables → New repository variable**, uma para
   cada:

| Variável                    | Valor                                                     |
| --------------------------- | --------------------------------------------------------- |
| `VITE_FIREBASE_API_KEY`     | `apiKey` do passo 4                                       |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` do passo 4                                   |
| `VITE_FIREBASE_PROJECT_ID`  | `projectId` do passo 4                                    |
| `VITE_FIREBASE_APP_ID`      | `appId` do passo 4                                        |
| `VITE_CLUB_NAME`            | Opcional. Nome exibido no site; o padrão é Clube do Livro |
| `VITE_GOOGLE_BOOKS_API_KEY` | Opcional. Veja "Capas do Google Livros" abaixo            |
| `VITE_APPCHECK_SITE_KEY`    | Opcional. Veja "App Check" abaixo                         |
| `VITE_AI_MODEL`             | Opcional. Veja "Conferência de indicações repetidas"      |

## 8. Publicar

Faça um push na `main` ou rode **Actions → Deploy → Run workflow** (só publica a `main`). Em
alguns minutos o site abre em `https://<seu-usuario>.github.io/<repositorio>/`.

Em **Settings → Environments → github-pages**, deixe só a `main` publicar.

**As regras não são publicadas pelo deploy.** Sempre que `firestore.rules` mudar, rode de novo o
comando do passo 5; até lá, o site usa as regras antigas.

Se faltar alguma variável, o deploy para e diz qual.

## 9. Abrir o clube

1. Entre no site com o seu email (Google ou link).
2. No menu da conta (o quadradinho com a sua inicial), abra **Organizar o clube**.
3. Em **Membros**, cole os emails do clube e clique em **Adicionar**. Ao abrir essa página, a
   contagem de "todos" se ajusta sozinha à lista.
4. Em **Rodada**, clique em **Abrir indicações**.

A partir daí o clube anda sozinho:

- quando todos responderem às indicações, a votação abre;
- quando todos votarem, sai o resultado;
- quando todos marcarem **Acabei de ler!**, a próxima rodada começa.

Se alguém sumir e travar a rodada, use os botões de **Organizar** para avançar.

## Opcionais

### Capas do Google Livros

Sem chave, as capas vêm do Open Library e do AniList. Com chave, o Google Livros entra na busca
e costuma ter as edições brasileiras.

1. No [Google Cloud Console](https://console.cloud.google.com), no mesmo projeto, ative a
   **Books API**.
2. Em **APIs e serviços → Credenciais**, crie uma **chave de API**.
3. Restrinja a chave:
   - **Referenciadores HTTP**: `https://<seu-usuario>.github.io/*` (ou o seu domínio);
   - **Restrições de API**: só a Books API.
4. Salve-a na variável `VITE_GOOGLE_BOOKS_API_KEY`.

A chave fica visível no site, como toda chave de navegador; a restrição por domínio é o que a
protege.

### App Check

O App Check impede que scripts fora do site usem o seu projeto Firebase.

1. Crie uma chave do **reCAPTCHA v3** em <https://www.google.com/recaptcha/admin>, com o domínio
   `<seu-usuario>.github.io`.
2. Em **Firebase → App Check**, registre o app da Web com essa chave.
3. Salve a chave de site na variável `VITE_APPCHECK_SITE_KEY` e publique.
4. Quando as métricas do App Check mostrarem só tráfego verificado, ative a **aplicação
   (enforcement)** para o Firestore, o Authentication e, se usar a conferência, o Firebase AI
   Logic.

### Conferência de indicações repetidas (Gemini)

Quando todos respondem, a lista de indicações se abre e o site procura o mesmo livro, do mesmo
autor, indicado mais de uma vez, inclusive em outra tradução ou edição ("Os Miseráveis" e "Les
Misérables"). Livros diferentes nunca viram um só, nem volumes de uma série ou livros da mesma
franquia. O que for certo vira uma opção só, sozinho (fica a indicação de quem indicou
primeiro); o que for dúvida fica para quem organiza decidir. Sem o Gemini, o site só reconhece
título e autor idênticos como certos, e o mesmo título com autor diferente ou sem autor como
dúvida.

A conferência roda no aparelho do primeiro membro que abrir o site depois que todos responderem,
e o resultado fica gravado; você não precisa estar on-line. Uma pessoa liberada para trocar
indica de novo vendo a lista, e a votação espera por ela até 3 dias.

O Firebase AI Logic não sabe quem é do clube: sem o App Check, qualquer pessoa usaria a sua cota
do Gemini com a configuração pública do site. Por isso o site só liga a conferência quando o App
Check também está configurado.

1. Configure o **App Check** (acima), com a aplicação ativa também para o Firebase AI Logic.
2. No Firebase, abra **AI Logic** (em Build) e clique em **Primeiros passos**. Escolha a
   **Gemini Developer API**, que tem cota gratuita. A chave do Gemini fica no Firebase; ela
   nunca vai para o site. Nas configurações do AI Logic, defina um **limite de pedidos por
   usuário** baixo: a conferência faz um pedido por rodada.
3. Confira a restrição da `apiKey` do passo 4: Firebase AI Logic API liberada, Generative
   Language API não.
4. Salve o nome do modelo na variável `VITE_AI_MODEL` (por exemplo, `gemini-3.5-flash-lite`) e
   publique.

Os títulos indicados são enviados ao Google para a conferência. No plano gratuito, o Google pode
usar o que recebe para melhorar os produtos dele.

Para medir a qualidade da conferência com a sua própria chave do Gemini (do
[AI Studio](https://aistudio.google.com/apikey)), sem publicar nada:

```sh
read -rs GEMINI_API_KEY && export GEMINI_API_KEY   # cola a chave sem mostrá-la nem guardá-la no histórico
npm run eval:duplicates
```

Nunca coloque essa chave em variáveis do repositório nem em arquivos versionados.

## Rodar com o seu Firebase no computador

Copie `.env.example` para `.env.local`, preencha os mesmos valores e rode `npm run dev`. O
`.env.local` é ignorado pelo git.

## Problemas comuns

- **"Este email não está na lista do clube"**: o documento em `allowlist` precisa ser o email
  exato, em minúsculas.
- **"Este email já entrou com outra conta"**: a pessoa apagou a conta ou entrou por outra.
  Veja o fim do passo 6.
- **Login com Google não abre**: confira o domínio autorizado (passo 2.2) e se o navegador não
  bloqueou a janela.
- **O link do email não entra**: ele precisa ser aberto no mesmo navegador em que foi pedido. Em
  outro aparelho, o site pergunta o email de novo.
- **Nada avança sozinho**: abra **Organizar** uma vez com a lista completa, para a contagem de
  membros ser gravada.
- **Todo mundo passou a vez**: sem indicações não há votação. Em **Organizar**, encerre a
  rodada e abra a próxima.
