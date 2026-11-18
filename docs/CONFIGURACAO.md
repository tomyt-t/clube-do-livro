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
2. Aba **Configurações → Domínios autorizados**: adicione `<seu-usuario>.github.io`. O
   `localhost` já vem na lista.
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
cada pessoa pode ler ou escrever são as regras do Firestore.

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

## 8. Publicar

Faça um push na `main` ou rode **Actions → Deploy → Run workflow**. Em alguns minutos o site
abre em `https://<seu-usuario>.github.io/<repositorio>/`.

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
   - **Referenciadores HTTP**: `https://<seu-usuario>.github.io/*` e `http://localhost:5173/*`;
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
   (enforcement)** para o Firestore e o Authentication.

## Rodar com o seu Firebase no computador

Copie `.env.example` para `.env.local`, preencha os mesmos valores e rode `npm run dev`. O
`.env.local` é ignorado pelo git.

## Problemas comuns

- **"Este email não está na lista do clube"**: o documento em `allowlist` precisa ser o email
  exato, em minúsculas.
- **Login com Google não abre**: confira o domínio autorizado (passo 2.2) e se o navegador não
  bloqueou a janela.
- **O link do email não entra**: ele precisa ser aberto no mesmo navegador em que foi pedido. Em
  outro aparelho, o site pergunta o email de novo.
- **Nada avança sozinho**: abra **Organizar** uma vez com a lista completa, para a contagem de
  membros ser gravada.
