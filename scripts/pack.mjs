import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

if (!existsSync(join('dist', 'index.html'))) {
  throw new Error('renderer build output missing: run pnpm run build before packing');
}
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = readFileSync('nimi.app.yaml', 'utf8');
const submission = readFileSync(join('.nimi', 'admission', 'submission.yaml'), 'utf8');
if (!manifest.includes('manifest_role: submitted-input')) {
  throw new Error('submitted manifest role marker missing');
}
if (!submission.includes('submission_role: developer-submitted-input')) {
  throw new Error('developer submission role marker missing');
}
mkdirSync('dist', { recursive: true });
const packet = {
  packetRole: 'developer-submitted-input',
  packageName: packageJson.name,
  appVersion: packageJson.version,
  shell: 'electron',
  rendererEntry: 'dist/index.html',
  electronMain: 'dist-electron/main.js',
  manifestPath: 'nimi.app.yaml',
  admissionRequestPath: '.nimi/admission/submission.yaml',
  generatedBy: '@nimiplatform/app-tools',
};
writeFileSync(join('dist', 'nimi-app-submission.json'), `${JSON.stringify(packet, null, 2)}\n`);
console.log('[nimi-app] pack wrote dist/nimi-app-submission.json');
