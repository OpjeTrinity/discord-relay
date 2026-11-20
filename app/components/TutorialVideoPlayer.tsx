'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface TutorialVideoPlayerProps {
  src?: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function TutorialVideoPlayer({
  src = '/tutorial.mp4',
  title = 'Setup & Usage Tutorial',
  className = '',
  autoPlay = false,
}: TutorialVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [useNativeControls, setUseNativeControls] = useState(false);

  // Synchronize playback speed
  const changeSpeed = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      setIsSpeedMenuOpen(false);
    }
  };

  const cycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    changeSpeed(SPEED_OPTIONS[nextIndex]);
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      if (newVolume === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
      } else if (isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  const seekRelative = (delta: number) => {
    if (!videoRef.current) return;
    const newTime = Math.min(Math.max(videoRef.current.currentTime + delta, 0), duration);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Update progress & buffered info
  const handleTimeUpdate = () => {
    if (!videoRef.current || isScrubbing) return;
    setCurrentTime(videoRef.current.currentTime);

    if (videoRef.current.buffered.length > 0) {
      try {
        const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        setBuffered(bufferedEnd);
      } catch {
        // ignore
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    setVolume(videoRef.current.volume);
    setIsMuted(videoRef.current.muted);
    setHasError(false);
  };

  // Auto-hide controls logic
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isSpeedMenuOpen) {
          setShowControls(false);
        }
      }, 2500);
    }
  };

  // Scrub bar handlers
  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
  };

  const handleProgressBarMouseLeave = () => {
    setHoverTime(null);
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Keyboard controls
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowLeft' || e.key === 'j') {
      e.preventDefault();
      seekRelative(-5);
    } else if (e.key === 'ArrowRight' || e.key === 'l') {
      e.preventDefault();
      seekRelative(5);
    } else if (e.key === 'm') {
      e.preventDefault();
      toggleMute();
    } else if (e.key === 'f') {
      e.preventDefault();
      toggleFullscreen();
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying && !isSpeedMenuOpen) setShowControls(false);
      }}
      className={`relative bg-[#000000] rounded-xl overflow-hidden shadow-2xl border border-[#383A40] select-none group focus:outline-none focus:ring-2 focus:ring-[#5865F2] ${className}`}
    >
      {/* Video Element */}
      <div className="relative aspect-video flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          src={src}
          autoPlay={autoPlay}
          playsInline
          preload="metadata"
          controls={useNativeControls}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={() => setHasError(true)}
          onClick={togglePlay}
          className="w-full h-full object-contain cursor-pointer"
        />

        {/* Big Center Play/Replay Button when Paused */}
        {!isPlaying && !useNativeControls && !hasError && (
          <button
            onClick={togglePlay}
            aria-label="Play video"
            className="absolute z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#5865F2]/90 hover:bg-[#5865F2] hover:scale-110 active:scale-95 transition-all text-white flex items-center justify-center shadow-2xl backdrop-blur-sm"
          >
            {currentTime >= duration && duration > 0 ? (
              /* Replay Icon */
              <svg className="w-8 h-8 sm:w-10 sm:h-10 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              /* Play Icon */
              <svg className="w-8 h-8 sm:w-10 sm:h-10 ml-1 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        )}

        {/* Error Fallback */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1E1F22] p-6 text-center text-[#DBDEE1]">
            <span className="text-4xl mb-2">⚠️</span>
            <p className="text-base font-semibold text-white">Video could not be loaded</p>
            <p className="text-xs text-[#949BA4] max-w-sm mt-1">
              Ensure the video file is placed in the public folder as <code className="bg-[#2B2D31] px-1 py-0.5 rounded text-[#5865F2]">public/tutorial.mp4</code>.
            </p>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="mt-4 px-4 py-1.5 rounded text-xs bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium"
            >
              Direct Video Link
            </a>
          </div>
        )}

        {/* Top Video Title Bar */}
        {!useNativeControls && (
          <div
            className={`absolute top-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 z-10 flex items-center justify-between ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5865F2]" />
              <span className="text-xs sm:text-sm font-semibold text-white drop-shadow truncate">
                {title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setUseNativeControls((prev) => !prev)}
                title="Switch between Custom and Native Browser Controls"
                className="px-2 py-1 rounded bg-[#2B2D31]/80 hover:bg-[#383A40] text-[11px] text-[#DBDEE1] transition-colors border border-white/10"
              >
                {useNativeControls ? 'Custom Player' : 'Native Controls'}
              </button>
            </div>
          </div>
        )}

        {/* Custom Video Control Overlay */}
        {!useNativeControls && !hasError && (
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-3 py-2 sm:px-4 sm:py-3 transition-opacity duration-300 z-20 flex flex-col gap-2 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Scrub / Progress Bar */}
            <div
              ref={progressBarRef}
              onClick={handleScrub}
              onMouseMove={handleProgressBarMouseMove}
              onMouseLeave={handleProgressBarMouseLeave}
              className="relative w-full h-2.5 group/progress cursor-pointer flex items-center"
            >
              {/* Progress Background Track */}
              <div className="w-full h-1.5 group-hover/progress:h-2 bg-[#383A40]/80 rounded-full overflow-hidden transition-all relative">
                {/* Buffered Bar */}
                <div
                  className="absolute top-0 left-0 bottom-0 bg-[#5865F2]/40 transition-all rounded-full"
                  style={{ width: `${bufferedPercent}%` }}
                />
                {/* Played Progress Bar */}
                <div
                  className="absolute top-0 left-0 bottom-0 bg-[#5865F2] rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Scrub Handle / Thumb */}
              <div
                className="absolute w-3.5 h-3.5 bg-white rounded-full shadow -translate-x-1/2 scale-0 group-hover/progress:scale-100 transition-transform pointer-events-none"
                style={{ left: `${progressPercent}%` }}
              />

              {/* Hover Timestamp Tooltip */}
              {hoverTime !== null && (
                <div
                  className="absolute bottom-5 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#1E1F22] text-[10px] font-mono text-white shadow border border-[#383A40] pointer-events-none"
                  style={{ left: `${hoverPosition}%` }}
                >
                  {formatTime(hoverTime)}
                </div>
              )}
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between text-[#DBDEE1] gap-2">
              {/* Left Side: Play/Pause, Rewind, Forward, Volume, Time */}
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                {/* Play / Pause Button */}
                <button
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
                >
                  {isPlaying ? (
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* Rewind 5s */}
                <button
                  onClick={() => seekRelative(-5)}
                  title="Rewind 5 seconds (← or J)"
                  className="p-1.5 rounded hover:bg-white/10 text-[#B5BAC1] hover:text-white transition-colors relative flex items-center justify-center"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                  </svg>
                  <span className="text-[9px] font-bold absolute -bottom-1 text-[#949BA4]">-5s</span>
                </button>

                {/* Forward 5s */}
                <button
                  onClick={() => seekRelative(5)}
                  title="Forward 5 seconds (→ or L)"
                  className="p-1.5 rounded hover:bg-white/10 text-[#B5BAC1] hover:text-white transition-colors relative flex items-center justify-center mr-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                  </svg>
                  <span className="text-[9px] font-bold absolute -bottom-1 text-[#949BA4]">+5s</span>
                </button>

                {/* Volume & Mute */}
                <div className="flex items-center gap-1 group/volume">
                  <button
                    onClick={toggleMute}
                    aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                    className="p-1.5 rounded hover:bg-white/10 text-[#B5BAC1] hover:text-white transition-colors"
                  >
                    {isMuted || volume === 0 ? (
                      /* Muted */
                      <svg className="w-5 h-5 fill-current text-[#F23F43]" viewBox="0 0 24 24">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    ) : volume < 0.5 ? (
                      /* Low volume */
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M7 9v6h4l5 5V4l-5 5H7z" />
                      </svg>
                    ) : (
                      /* High volume */
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                    )}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-14 sm:w-20 h-1 bg-[#383A40] rounded-lg appearance-none cursor-pointer accent-[#5865F2] hover:accent-[#4752C4]"
                  />
                </div>

                {/* Time Display */}
                <div className="text-[11px] sm:text-xs font-mono text-[#949BA4] ml-1">
                  <span className="text-[#DBDEE1]">{formatTime(currentTime)}</span>
                  <span className="mx-1">/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right Side: Speed Selector, PiP, Fullscreen */}
              <div className="flex items-center gap-1 sm:gap-2 relative">
                {/* Speed Selector (Adjustable Playback Speed) */}
                <div className="relative">
                  <button
                    onClick={() => setIsSpeedMenuOpen((prev) => !prev)}
                    title="Playback Speed"
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#1E1F22]/80 hover:bg-[#2B2D31] text-[11px] font-semibold text-white border border-[#383A40] transition-colors"
                  >
                    <span>⚡</span>
                    <span>{playbackSpeed}x</span>
                  </button>

                  {/* Speed Popup Menu */}
                  {isSpeedMenuOpen && (
                    <div className="absolute bottom-9 right-0 bg-[#2B2D31] border border-[#383A40] rounded-lg p-1.5 shadow-2xl flex flex-col gap-0.5 z-30 min-w-[80px]">
                      <div className="px-2 py-1 text-[10px] font-bold text-[#949BA4] uppercase border-b border-[#383A40] mb-1">
                        Speed
                      </div>
                      {SPEED_OPTIONS.map((speed) => (
                        <button
                          key={speed}
                          onClick={() => changeSpeed(speed)}
                          className={`px-2.5 py-1 text-xs text-left rounded flex items-center justify-between transition-colors ${
                            playbackSpeed === speed
                              ? 'bg-[#5865F2] text-white font-bold'
                              : 'text-[#DBDEE1] hover:bg-[#383A40]'
                          }`}
                        >
                          <span>{speed}x</span>
                          {playbackSpeed === speed && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cycle speed quick button for mobile / single tap */}
                <button
                  onClick={cycleSpeed}
                  title="Quick toggle speed (0.75x, 1x, 1.25x, 1.5x, 2x)"
                  className="sm:hidden px-2 py-1 rounded bg-[#2B2D31] text-[11px] font-mono text-[#DBDEE1]"
                >
                  +Spd
                </button>

                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  className="p-1.5 rounded hover:bg-white/10 text-[#B5BAC1] hover:text-white transition-colors"
                >
                  {isFullscreen ? (
                    /* Compress */
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    /* Expand */
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Helper hotkey bar below video */}
      <div className="bg-[#2B2D31] px-4 py-2 border-t border-[#383A40] flex items-center justify-between text-[11px] text-[#949BA4] flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span><kbd className="bg-[#1E1F22] px-1.5 py-0.5 rounded text-[#DBDEE1] font-mono">Space</kbd> Play/Pause</span>
          <span><kbd className="bg-[#1E1F22] px-1.5 py-0.5 rounded text-[#DBDEE1] font-mono">← / →</kbd> -/+ 5s</span>
          <span><kbd className="bg-[#1E1F22] px-1.5 py-0.5 rounded text-[#DBDEE1] font-mono">M</kbd> Mute</span>
          <span><kbd className="bg-[#1E1F22] px-1.5 py-0.5 rounded text-[#DBDEE1] font-mono">F</kbd> Fullscreen</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={src}
            download="discord-relay-tutorial.mp4"
            className="text-[#5865F2] hover:text-[#4752C4] hover:underline font-medium flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Video
          </a>
        </div>
      </div>
    </div>
  );
}
