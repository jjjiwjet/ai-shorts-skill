// Merges each data/videos/*.json with the visuals and narration found in public/<video>/, writes src/manifest.json.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const videosDir = path.join(root, 'data/videos');
const pub = (...p) => path.join(root, 'public', ...p);

const VISUAL_EXT = ['mp4', 'mov', 'webm', 'png', 'jpg', 'jpeg', 'webp'];
const AUDIO_EXT = ['wav', 'mp3'];
// Rough Korean narration speed used until real TTS exists.
const CHARS_PER_SEC = 5;

const find = (dir, id, exts) => {
  for (const ext of exts) {
    const f = `${dir}/${id}.${ext}`;
    if (fs.existsSync(pub(f))) return f;
  }
  return null;
};

const wavDuration = (file) => {
  const buf = fs.readFileSync(file);
  let off = 12;
  let byteRate = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') byteRate = buf.readUInt32LE(off + 16);
    if (id === 'data') return size / byteRate;
    off += 8 + size + (size % 2);
  }
  return null;
};

const manifest = {};
for (const file of fs.readdirSync(videosDir).filter((f) => f.endsWith('.json')).sort()) {
  const video = JSON.parse(fs.readFileSync(path.join(videosDir, file), 'utf8'));
  const durationsFile = pub(video.id, 'audio/durations.json');
  const known = fs.existsSync(durationsFile) ? JSON.parse(fs.readFileSync(durationsFile, 'utf8')) : {};

  const scenes = video.scenes.map((s) => {
    const audio = find(`${video.id}/audio`, s.id, AUDIO_EXT);
    let duration = audio ? known[s.id] ?? null : null;
    if (audio && duration == null && audio.endsWith('.wav')) duration = wavDuration(pub(audio));
    const estimated = duration == null;
    if (estimated) duration = s.narration.replace(/\s/g, '').length / CHARS_PER_SEC;
    return { id: s.id, visual: find(`${video.id}/assets`, s.id, VISUAL_EXT), audio, duration, estimated };
  });
  const bgm = find(`${video.id}/bgm`, 'bgm', AUDIO_EXT);
  manifest[video.id] = { ...video, bgm, scenes: video.scenes.map((s, i) => ({ ...s, ...scenes[i] })) };

  const missing = (k) => scenes.filter((s) => !s[k]).map((s) => s.id);
  const total = scenes.reduce((a, s) => a + s.duration, 0);
  console.log(`${video.id}: ${scenes.length} scenes, ~${total.toFixed(1)}s`);
  if (missing('visual').length) console.log(`  missing visuals: ${missing('visual').join(', ')}`);
  if (missing('audio').length) console.log(`  missing audio (timing estimated): ${missing('audio').join(', ')}`);
}

fs.writeFileSync(path.join(root, 'src/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
