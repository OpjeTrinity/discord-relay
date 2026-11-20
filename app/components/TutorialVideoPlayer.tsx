'use client';

import React from 'react';

interface TutorialVideoPlayerProps {
  src?: string;
  className?: string;
  autoPlay?: boolean;
}

export default function TutorialVideoPlayer({
  src = '/tutorial.mp4',
  className = '',
  autoPlay = false,
}: TutorialVideoPlayerProps) {
  return (
    <div className={`w-full max-w-md mx-auto rounded-lg overflow-hidden shadow-lg bg-black border border-[#383A40] ${className}`}>
      <div className="relative aspect-video w-full bg-black flex items-center justify-center">
        <video
          src={src}
          controls
          autoPlay={autoPlay}
          playsInline
          preload="metadata"
          className="w-full h-full object-contain"
        >
          <track
            kind="subtitles"
            src="/subtitles-es.vtt"
            srcLang="es"
            label="Español"
            default
          />
          <track
            kind="subtitles"
            src="/subtitles-en.vtt"
            srcLang="en"
            label="English"
          />
          Your browser does not support HTML5 video.
        </video>
      </div>
    </div>
  );
}
