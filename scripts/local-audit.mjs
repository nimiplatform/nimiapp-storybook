import { readFileSync } from 'node:fs';

const boundary = readFileSync(new URL('../.nimi/contracts/scaffold-boundary.yaml', import.meta.url), 'utf8');
const gitignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
const release = readFileSync(new URL('../RELEASE.md', import.meta.url), 'utf8');
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
if (!boundary.includes('local_audit_role: pre-submission-self-check')) {
  throw new Error('local audit role marker missing');
}
for (const marker of ['app-owned-oauth-token-exchange', 'local-first-party-auth-shim', 'provider-model-hardcoding']) {
  if (!boundary.includes(marker)) {
    throw new Error(`scaffold boundary missing forbidden shortcut marker: ${marker}`);
  }
}
for (const marker of ['.nimi/local/', '.nimi/cache/', '.nimi/topics/']) {
  if (!gitignore.includes(marker)) {
    throw new Error(`gitignore missing nimicoding local-state marker: ${marker}`);
  }
}
if (!release.includes('pnpm exec nimicoding sync --check') || !changelog.includes('.nimi/spec/storybook/kernel/**')) {
  throw new Error('release/changelog governance markers missing');
}
console.log('[nimi-app] local-audit pre-submission self-check passed');
