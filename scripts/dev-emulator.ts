/**
 * `npm run dev:emulator`: the site on the local Auth and Firestore emulators,
 * with what was created kept in `.emulator-data/` between runs (Ctrl+C saves).
 *
 * On Windows the emulators' own save can stop at its last step (renaming its
 * folder fails with EPERM while the new files are still being scanned), so
 * this finishes it. The emulators need Java: JAVA_HOME is enough.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

const DATA = '.emulator-data';
const FIREBASE = path.join('node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const SITE = 'node scripts/emulator-seed.ts && vite --mode emulator';

function print(line: string) {
  process.stdout.write(`${line}\n`);
}

function pause(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** The emulators' environment, with JAVA_HOME's java first on the path. */
function withJava(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const javaHome = env.JAVA_HOME;
  if (!javaHome) return env;
  const key = Object.keys(env).find((name) => name.toUpperCase() === 'PATH') ?? 'PATH';
  env[key] = [path.join(javaHome, 'bin'), env[key]].filter(Boolean).join(path.delimiter);
  return env;
}

/** Moves the newest unfinished save into place, retrying while Windows holds the files. */
function finishSave() {
  const saves = readdirSync('.')
    .filter((name) => name.startsWith('firebase-export-'))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  const [latest, ...older] = saves;
  if (!latest) return;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      rmSync(DATA, { recursive: true, force: true });
      renameSync(latest, DATA);
      for (const name of older) rmSync(name, { recursive: true, force: true });
      print(`Dados salvos em ${DATA}.`);
      return;
    } catch {
      pause(500);
    }
  }
  print(`Não deu para salvar em ${DATA}: os dados ficaram em ${latest}.`);
}

// Ctrl+C reaches the emulators too; wait for them to save, then tidy up.
process.on('SIGINT', () => undefined);

const args = [
  FIREBASE,
  'emulators:exec',
  '--only',
  'auth,firestore',
  '--ui',
  '--project',
  'demo-clube-do-livro',
  ...(existsSync(DATA) ? ['--import', DATA] : []),
  '--export-on-exit',
  DATA,
  SITE,
];
const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: withJava() });
finishSave();
process.exit(result.status ?? 0);
