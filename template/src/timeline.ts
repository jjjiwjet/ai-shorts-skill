import manifest from './manifest.json';

export const FPS = 30;
// Frames each scene overlaps the next for the crossfade.
export const FADE = 8;
// Breathing room after each narration line.
const GAP = 0.35;
const OUTRO = 1.2;

export type Theme = 'comic' | 'pixel';

type SceneData = {
  id: string;
  narration: string;
  highlight: string[];
  motion: string;
  prompt: string;
  hook?: string[];
  visual: string | null;
  audio: string | null;
  duration: number;
};

type VideoData = { id: string; theme: string; title: string; bgm: string | null; scenes: SceneData[] };

export type Scene = SceneData & { from: number; frames: number };

export type Video = {
  id: string;
  theme: Theme;
  title: string;
  bgm: string | null;
  scenes: Scene[];
  totalFrames: number;
};

const build = (data: VideoData): Video => {
  let cursor = 0;
  const scenes = data.scenes.map((s, i) => {
    const tail = i === data.scenes.length - 1 ? OUTRO : GAP;
    const frames = Math.ceil((s.duration + tail) * FPS);
    const scene = { ...s, from: cursor, frames };
    cursor += frames;
    return scene;
  });
  return { id: data.id, theme: data.theme as Theme, title: data.title, bgm: data.bgm, scenes, totalFrames: cursor };
};

export const videos: Video[] = (Object.values(manifest) as VideoData[]).map(build);
