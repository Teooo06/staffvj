const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const platform = process.argv[2];
const arch = process.argv[3];
const packageVersion = '2.0.2';
const supported = new Set([
  'darwin-arm64',
  'darwin-x64',
  'win32-x64',
  'win32-ia32',
  'linux-x64',
  'linux-arm64',
  'linux-armv7l',
]);

if (!supported.has(`${platform}-${arch}`)) {
  console.error(`Piattaforma NDI non supportata: ${platform}-${arch}`);
  process.exit(1);
}

const packageName = `@grandi/${platform}-${arch}`;
const destination = path.join(root, 'node_modules', '@grandi', `${platform}-${arch}`);
if (fs.existsSync(destination)) {
  console.log(`${packageName} è già installato.`);
  process.exit(0);
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'staffvj-ndi-'));
try {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const packed = spawnSync(
    npmCommand,
    ['pack', `${packageName}@${packageVersion}`, `--pack-destination=${temp}`],
    { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (packed.status !== 0) throw new Error(`npm pack è terminato con codice ${packed.status}`);

  const archive = fs.readdirSync(temp).find((entry) => entry.endsWith('.tgz'));
  if (!archive) throw new Error('npm pack non ha prodotto il pacchetto NDI');
  const extracted = spawnSync('tar', ['-xzf', path.join(temp, archive), '-C', temp], {
    cwd: root,
    stdio: 'inherit',
  });
  if (extracted.status !== 0) throw new Error(`Estrazione pacchetto terminata con codice ${extracted.status}`);

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(path.join(temp, 'package'), destination, { recursive: true });
  console.log(`${packageName}@${packageVersion} preparato per il packaging.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
