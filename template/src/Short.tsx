import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { loadFont as loadGoogleFont } from '@remotion/google-fonts/BlackHanSans';
import { loadFont as loadLocalFont } from '@remotion/fonts';
import { FADE, type Scene, type Theme, type Video } from './timeline';

const { fontFamily: comicFont } = loadGoogleFont('normal', { subsets: ['korean'], ignoreTooManyRequestsWarning: true });
const PIXEL_FONT = 'Galmuri11';
loadLocalFont({ family: PIXEL_FONT, url: staticFile('fonts/Galmuri11-Bold.woff2'), weight: '700' });

const YELLOW = '#FFE14D';
const ORANGE = '#FF7A1A';
const CYAN = '#5CF2FF';

// Pixel theme updates motion every few frames so it reads like sprite animation.
const PIXEL_STEP = 3;
const stepFrame = (frame: number, theme: Theme) => (theme === 'pixel' ? Math.floor(frame / PIXEL_STEP) * PIXEL_STEP : frame);

const comicText = (px: number): React.CSSProperties => ({
  fontFamily: comicFont,
  color: 'white',
  WebkitTextStroke: `${px}px black`,
  paintOrder: 'stroke fill',
  textShadow: `0 ${px}px 0 rgba(0,0,0,0.6)`,
  lineHeight: 1.15,
  letterSpacing: '-0.01em',
});

// Hard-edged outline built from offset shadows, no blur, so glyph edges stay pixel-crisp.
const pixelText = (px: number): React.CSSProperties => {
  const offsets = [-px, 0, px].flatMap((x) => [-px, 0, px].map((y) => [x, y])).filter(([x, y]) => x || y);
  return {
    fontFamily: PIXEL_FONT,
    fontWeight: 700,
    color: 'white',
    textShadow: [...offsets.map(([x, y]) => `${x}px ${y}px 0 #000`), `${px * 2}px ${px * 2}px 0 #000`].join(','),
    lineHeight: 1.3,
    WebkitFontSmoothing: 'none',
  };
};

const isVideo = (f: string) => /\.(mp4|mov|webm)$/i.test(f);

// Slow Ken Burns move on stills so every shot feels animated.
const Visual: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  const frame = stepFrame(useCurrentFrame(), theme);
  const t = frame / (scene.frames + FADE);
  // Minimum scale 1.1 crops the panel border Flow tends to draw around each image.
  const moves: Record<string, { scale: [number, number]; x: [number, number] }> = {
    zoomIn: { scale: [1.1, 1.26], x: [0, 0] },
    zoomOut: { scale: [1.27, 1.1], x: [0, 0] },
    panRight: { scale: [1.2, 1.2], x: [-50, 50] },
    panLeft: { scale: [1.2, 1.2], x: [50, -50] },
  };
  const m = moves[scene.motion] ?? moves.zoomIn;
  const transform = `scale(${interpolate(t, [0, 1], m.scale)}) translateX(${interpolate(t, [0, 1], m.x)}px)`;

  if (!scene.visual) return <Placeholder scene={scene} transform={transform} />;
  const src = staticFile(scene.visual);
  const fill: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform,
    imageRendering: theme === 'pixel' ? 'pixelated' : 'auto',
  };
  return isVideo(scene.visual) ? <OffthreadVideo src={src} muted style={fill} /> : <Img src={src} style={fill} />;
};

const Placeholder: React.FC<{ scene: Scene; transform: string }> = ({ scene, transform }) => (
  <AbsoluteFill
    style={{
      background: 'radial-gradient(circle at 50% 35%, #c9773a 0%, #6b2f17 55%, #1d0e08 100%)',
      transform,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 120,
    }}
  >
    <div style={{ fontFamily: comicFont, fontSize: 64, color: 'rgba(255,255,255,0.35)' }}>{scene.id}</div>
    <div style={{ fontSize: 30, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 24 }}>
      {scene.prompt}
    </div>
  </AbsoluteFill>
);

// Splits narration into short caption cards, timed by character count.
const captionChunks = (text: string, maxChars = 15) => {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxChars) {
      chunks.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
    if (/[.?!]$/.test(w)) {
      chunks.push(cur);
      cur = '';
    }
  }
  if (cur) chunks.push(cur);
  return chunks.map((c) => c.replace(/[.,]$/, ''));
};

const Highlighted: React.FC<{ text: string; words: string[]; color: string }> = ({ text, words, color }) => {
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);
  return (
    <>
      {text.split(pattern).map((part, i) => (
        <span key={i} style={{ color: words.includes(part) ? color : undefined }}>
          {part}
        </span>
      ))}
    </>
  );
};

const useCaption = (scene: Scene, speechFrames: number) => {
  const frame = useCurrentFrame();
  const chunks = captionChunks(scene.narration);
  const weights = chunks.map((c) => c.replace(/\s/g, '').length);
  const sum = weights.reduce((a, b) => a + b, 0);
  let start = 0;
  const timed = chunks.map((c, i) => {
    const len = (weights[i] / sum) * speechFrames;
    const item = { text: c, start, end: start + len };
    start += len;
    return item;
  });
  const idx = timed.findIndex((c) => frame < c.end);
  return { frame, cur: timed[idx === -1 ? timed.length - 1 : idx] };
};

const ComicCaptions: React.FC<{ scene: Scene; speechFrames: number }> = ({ scene, speechFrames }) => {
  const { fps } = useVideoConfig();
  const { frame, cur } = useCaption(scene, speechFrames);
  const pop = spring({ frame: frame - cur.start, fps, config: { damping: 14, stiffness: 220 } });

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 430 }}>
      <div
        style={{
          ...comicText(14),
          fontSize: 88,
          textAlign: 'center',
          maxWidth: 960,
          transform: `scale(${interpolate(pop, [0, 1], [0.85, 1])})`,
        }}
      >
        <Highlighted text={cur.text} words={scene.highlight} color={YELLOW} />
      </div>
    </AbsoluteFill>
  );
};

// RPG-style dialog box with a typewriter reveal.
const PixelCaptions: React.FC<{ scene: Scene; speechFrames: number }> = ({ scene, speechFrames }) => {
  const { frame, cur } = useCaption(scene, speechFrames);
  const chars = [...cur.text];
  const shown = Math.min(chars.length, Math.floor((frame - cur.start) / 1.2) + 1);
  const visible = chars.slice(0, shown).join('');
  const blink = Math.floor(frame / 12) % 2 === 0;

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 360 }}>
      <div
        style={{
          width: 960,
          minHeight: 210,
          background: 'rgba(10, 12, 40, 0.92)',
          border: '8px solid white',
          boxShadow: '0 0 0 8px #000, 12px 12px 0 8px rgba(0,0,0,0.6)',
          padding: '36px 44px',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <div style={{ ...pixelText(4), fontSize: 66, width: '100%', wordBreak: 'keep-all' }}>
          <Highlighted text={visible} words={scene.highlight} color={YELLOW} />
        </div>
        {shown === chars.length && blink && (
          <div style={{ position: 'absolute', right: 28, bottom: 18, color: 'white', fontSize: 36, fontFamily: PIXEL_FONT }}>
            ▼
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

const Hook: React.FC<{ lines: string[]; theme: Theme }> = ({ lines, theme }) => {
  const frame = stepFrame(useCurrentFrame(), theme);
  const { fps } = useVideoConfig();
  const pixel = theme === 'pixel';
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: pixel ? 24 : 10 }}>
      {lines.map((line, i) => {
        const s = spring({ frame: frame - i * 8, fps, config: { damping: 10, stiffness: 180 } });
        const style = pixel
          ? { ...pixelText(8), fontSize: 112, color: i === 0 ? CYAN : YELLOW, transform: `translateY(${(1 - s) * 200}px)`, opacity: s > 0.05 ? 1 : 0 }
          : { ...comicText(20), fontSize: 130, color: i === 0 ? ORANGE : YELLOW, transform: `scale(${s}) rotate(${interpolate(s, [0, 1], [-6, 0])}deg)` };
        return (
          <div key={line} style={{ ...style, textAlign: 'center', padding: '0 40px' }}>
            {line}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const TitleBar: React.FC<{ title: string; theme: Theme }> = ({ title, theme }) =>
  theme === 'pixel' ? (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 160 }}>
      <div
        style={{
          ...pixelText(4),
          fontSize: 54,
          color: YELLOW,
          background: 'rgba(0,0,0,0.75)',
          border: '6px solid ' + YELLOW,
          padding: '14px 28px',
          textAlign: 'center',
          maxWidth: 980,
        }}
      >
        {title}
      </div>
    </AbsoluteFill>
  ) : (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 170 }}>
      <div style={{ ...comicText(12), fontSize: 72, color: YELLOW, textAlign: 'center' }}>{title}</div>
    </AbsoluteFill>
  );

// Faint CRT scanlines for the retro game look.
const Scanlines: React.FC = () => (
  <AbsoluteFill
    style={{
      background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 3px, transparent 3px, transparent 6px)',
      pointerEvents: 'none',
    }}
  />
);

const SceneView: React.FC<{ scene: Scene; video: Video }> = ({ scene, video }) => {
  const frame = useCurrentFrame();
  const { theme } = video;
  const progress = interpolate(frame, [0, FADE], [0, 1], { extrapolateRight: 'clamp' });
  // Pixel theme fades in hard steps instead of a smooth dissolve.
  const opacity = theme === 'pixel' ? Math.floor(progress * 4) / 4 : progress;
  const isHook = Boolean(scene.hook);
  const Captions = theme === 'pixel' ? PixelCaptions : ComicCaptions;
  return (
    <AbsoluteFill style={{ opacity, backgroundColor: 'black' }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Visual scene={scene} theme={theme} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.6) 100%)',
        }}
      />
      {theme === 'pixel' && <Scanlines />}
      {scene.audio && <Audio src={staticFile(scene.audio)} />}
      {isHook ? <Hook lines={scene.hook!} theme={theme} /> : <TitleBar title={video.title} theme={theme} />}
      {!isHook && <Captions scene={scene} speechFrames={scene.frames - FADE} />}
    </AbsoluteFill>
  );
};

export const Short: React.FC<{ video: Video }> = ({ video }) => (
  <AbsoluteFill style={{ backgroundColor: 'black' }}>
    {video.bgm && <Audio src={staticFile(video.bgm)} volume={0.12} loop />}
    {video.scenes.map((scene, i) => (
      <Sequence
        key={scene.id}
        from={scene.from}
        durationInFrames={scene.frames + (i < video.scenes.length - 1 ? FADE : 0)}
      >
        <SceneView scene={scene} video={video} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
