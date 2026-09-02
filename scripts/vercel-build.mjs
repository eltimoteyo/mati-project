import { spawnSync } from 'node:child_process';

const root = process.cwd();
for (const target of ['@conit/web']) {
  const result = spawnSync('pnpm', ['--filter', target, 'build'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
