// Renders each composition to out/<id>.mp4. Pass ids to render a subset: npm run render -- next-word move-37
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const all = fs.readdirSync(path.join(root, 'data/videos')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const ids = process.argv.length > 2 ? process.argv.slice(2) : all;

for (const id of ids) {
  execFileSync('npx', ['remotion', 'render', 'src/index.ts', id, `out/${id}.mp4`], { cwd: root, stdio: 'inherit' });
}
