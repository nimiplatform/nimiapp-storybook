import { readFileSync } from 'node:fs';

const manifest = readFileSync(new URL('../nimi.app.yaml', import.meta.url), 'utf8');
const submission = readFileSync(new URL('../.nimi/admission/submission.yaml', import.meta.url), 'utf8');
const appIdentity = readFileSync(new URL('../.nimi/config/app-identity.yaml', import.meta.url), 'utf8');
const buildProfile = readFileSync(new URL('../.nimi/config/build-profile.yaml', import.meta.url), 'utf8');
const specIndex = readFileSync(new URL('../.nimi/spec/INDEX.md', import.meta.url), 'utf8');
const kernelIndex = readFileSync(new URL('../.nimi/spec/storybook/kernel/index.md', import.meta.url), 'utf8');
if (!manifest.includes('manifest_role: submitted-input')) {
  throw new Error('submitted manifest role marker missing');
}
if (!submission.includes('submission_role: developer-submitted-input')) {
  throw new Error('developer submission role marker missing');
}
if (!submission.includes('dev_shell_command: pnpm dev:shell')) {
  throw new Error('dev shell command marker missing');
}
if (!appIdentity.includes('app_id: nimi.storybook') || !appIdentity.includes('tauri_identifier: nimi.storybook')) {
  throw new Error('app identity projection is missing Storybook identity');
}
if (!buildProfile.includes('build_command: pnpm run build')) {
  throw new Error('build profile is missing build command');
}
if (!specIndex.includes('storybook') || !kernelIndex.includes('SBK-PROD')) {
  throw new Error('Storybook product authority spec is missing');
}
console.log('[nimi-app] validate pre-submission self-check passed');
