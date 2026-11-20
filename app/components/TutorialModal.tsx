'use client';

import React, { useEffect } from 'react';
import TutorialVideoPlayer from './TutorialVideoPlayer';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  videoSrc?: string;
}

export default function TutorialModal({
  isOpen,
  onClose,
  title = 'Video Tutorial',
  subtitle = 'Discord Auth Relay Walkthrough',
  videoSrc = '/tutorial.mp4',
}: TutorialModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#2B2D31] border border-[#383A40] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1E1F22] border-b border-[#383A40]">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              {title}
            </h3>
            <p className="text-[11px] text-[#949BA4]">
              {subtitle}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-7 h-7 rounded-full bg-[#2B2D31] hover:bg-[#383A40] text-[#949BA4] hover:text-white flex items-center justify-center transition-colors border border-[#383A40]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body / Compact Video Player without instructions */}
        <div className="p-4 bg-[#2B2D31] flex flex-col items-center">
          <TutorialVideoPlayer
            src={videoSrc}
            autoPlay={true}
          />
        </div>
      </div>
    </div>
  );
}
