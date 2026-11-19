/**
 * Prepares the local emulators for `npm run dev:emulator`: the organizer and
 * three members on the allowlist, so a whole round can be played by signing
 * in as each one. Talks only to the Firestore emulator, and only fills an
 * empty allowlist, so whatever was created before survives a restart.
 */

const PROJECT = 'demo-clube-do-livro';
const DOCUMENTS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
/** The emulator lets "owner" past the rules. */
const HEADERS = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

const PEOPLE = [
  { email: 'organizador@exemplo.com', admin: true },
  { email: 'ana@exemplo.com', admin: false },
  { email: 'bia@exemplo.com', admin: false },
  { email: 'caio@exemplo.com', admin: false },
];

function print(line: string) {
  process.stdout.write(`${line}\n`);
}

async function call(path: string, body?: object): Promise<unknown> {
  const response = await fetch(`${DOCUMENTS}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`${path}: ${String(response.status)} ${await response.text()}`);
  }
  return response.json();
}

async function seed() {
  const listed = (await call('allowlist?pageSize=1')) as { documents?: unknown[] };
  if (listed.documents?.length) {
    print('Emulador com dados de antes: nada a preparar.');
    return;
  }
  for (const { email, admin } of PEOPLE) {
    const fields = admin ? { admin: { booleanValue: true } } : {};
    await call(`allowlist?documentId=${encodeURIComponent(email)}`, { fields });
  }
  await call('settings?documentId=club', {
    fields: { members: { integerValue: String(PEOPLE.length) } },
  });
  print('Emulador pronto. Entre com o Google com um destes emails (o organizador é o primeiro):');
  for (const { email } of PEOPLE) print(`  ${email}`);
}

await seed();
