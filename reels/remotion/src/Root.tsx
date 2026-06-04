import React from 'react';
import {
  AbsoluteFill,
  Composition,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from 'remotion';

type Shot = {
  filename: string;
  caption: string;
  durationInSeconds: number;
};

type Props = {
  shots: Shot[];
  fps: number;
  totalDurationInFrames?: number;
};

function ShotFrame({
  shot,
  durationInFrames
}: {
  shot: Shot;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const fadeOut = interpolate(
    frame,
    [Math.max(0, durationInFrames - 12), Math.max(0, durationInFrames - 1)],
    [1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp'
    }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(180deg, rgba(2,6,23,.9) 0%, rgba(2,6,23,.85) 100%)'
        }}
      >
        <img
          src={staticFile(`frames/${shot.filename}`)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center top',
            opacity
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 44,
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            color: '#f8fafc',
            fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(26px, 4.2vw, 46px)',
            lineHeight: 1.2,
            textAlign: 'center',
            padding: '12px 18px',
            borderRadius: 16,
            maxWidth: '90%',
            background: 'rgba(15,23,42,0.72)',
            boxShadow: '0 14px 28px rgba(15,23,42,.35)',
            opacity
          }}
        >
          {shot.caption}
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function NunchiMobileReel({
  shots = [],
  totalDurationInFrames,
  fps: fallbackFps
}: Props) {
  const { fps } = useVideoConfig();
  const effectiveFps = fallbackFps || fps;
  let cursor = 0;

  const shotElements = shots.map((shot, index) => {
    const frameLength = Math.max(1, Math.round((shot.durationInSeconds || 2.2) * effectiveFps));
    const start = cursor;
    cursor += frameLength;

    return (
      <Sequence from={start} durationInFrames={frameLength} name={`shot-${index + 1}`} key={shot.filename}>
        <ShotFrame shot={shot} durationInFrames={frameLength} />
      </Sequence>
    );
  });

  const fallback = (
    <AbsoluteFill
      style={{
        backgroundColor: '#0b1220',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#f8fafc'
      }}
    >
      <div style={{ padding: 20, fontSize: 38, textAlign: 'center' }}>스크린샷 캡처가 필요해요</div>
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {shots.length ? shotElements : fallback}
    </AbsoluteFill>
  );
}

function NunchiReelThumbnail() {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a' }}>
      <img
        src={staticFile('frames/shot-01-home.png')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center top'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px'
        }}
      >
        <div
          style={{
            alignSelf: 'flex-start',
            color: '#0f172a',
            background: '#ffffffee',
            borderRadius: 20,
            padding: '8px 14px',
            fontWeight: 900,
            fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
            letterSpacing: '-0.03em',
            fontSize: 28
          }}
        >
          눈치온도
        </div>
        <div
          style={{
            color: '#f8fafc',
            background: 'rgba(15,23,42,0.76)',
            borderRadius: 24,
            padding: '18px 20px',
            fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
            fontWeight: 800,
            fontSize: 52,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            maxWidth: '84%',
            boxShadow: '0 16px 36px rgba(2,6,23,.35)'
          }}
        >
          사무실 온도 투표
          <br />
          10초면 결정된다
        </div>
      </div>
    </AbsoluteFill>
  );
}

function NunchiReelThumbnailBold() {
  return (
    <AbsoluteFill style={{ backgroundColor: '#111827' }}>
      <img
        src={staticFile('frames/shot-03-hot-hot.png')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center top',
          filter: 'brightness(0.8)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px'
        }}
      >
        <div
          style={{
            alignSelf: 'flex-end',
            color: '#ffffff',
            background: 'rgba(15,23,42,0.72)',
            borderRadius: 20,
            padding: '8px 14px',
            fontWeight: 900,
            fontSize: 22,
            fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif'
          }}
        >
          실시간 익명 투표
        </div>
        <div
          style={{
            color: '#0f172a',
            background: '#ffffffee',
            borderRadius: 24,
            padding: '18px 20px',
            fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
            fontWeight: 900,
            fontSize: 52,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            alignSelf: 'flex-start',
            maxWidth: '84%',
            boxShadow: '0 18px 40px rgba(2,6,23,.45)'
          }}
        >
          지금 바로
          <br />
          온도 합의
        </div>
      </div>
    </AbsoluteFill>
  );
}

function NunchiReelThumbnailMinimal() {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b1220' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '64px 48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
        <div
          style={{
            color: '#f8fafc',
            background: 'rgba(255,255,255,0.14)',
            width: 'fit-content',
            padding: '10px 14px',
            borderRadius: 999,
            fontWeight: 800,
            fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
            letterSpacing: '-0.02em',
            fontSize: 20
          }}
        >
          눈치온도
        </div>
        <div
          style={{
            color: '#f8fafc',
            fontWeight: 900,
            fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
            letterSpacing: '-0.04em',
            fontSize: 72,
            lineHeight: 1
          }}
        >
          사무실 온도
          <br />
          딱 10초면 충분
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function NunchiRemotionRoot() {
  const fallback = {
    fps: 30,
    totalDurationInFrames: 220,
    shots: [
      {
        filename: 'shot-01-home.png',
        caption: '준비 중',
        durationInSeconds: 2.5
      },
      {
        filename: 'shot-06-hot-majority.png',
        caption: '결정 완료',
        durationInSeconds: 2.2
      }
    ]
  };

  return (
    <>
      <Composition
        id="NunchiMobileReel"
        component={NunchiMobileReel}
        durationInFrames={fallback.totalDurationInFrames}
        fps={fallback.fps}
        width={1080}
        height={1920}
        defaultProps={fallback as Props}
      />
      <Composition
        id="NunchiReelThumbnail"
        component={NunchiReelThumbnail}
        durationInFrames={30}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="NunchiReelThumbnailBold"
        component={NunchiReelThumbnailBold}
        durationInFrames={30}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="NunchiReelThumbnailMinimal"
        component={NunchiReelThumbnailMinimal}
        durationInFrames={30}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
}
