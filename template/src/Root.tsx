import { Composition } from 'remotion';
import { Short } from './Short';
import { FPS, videos } from './timeline';

export const RemotionRoot = () => (
  <>
    {videos.map((video) => (
      <Composition
        key={video.id}
        id={video.id}
        component={Short}
        defaultProps={{ video }}
        durationInFrames={video.totalFrames}
        fps={FPS}
        width={1080}
        height={1920}
      />
    ))}
  </>
);
