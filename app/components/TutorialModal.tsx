'use client';

import React, { useEffect } from 'react';
import TutorialVideoPlayer from './TutorialVideoPlayer';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  videoSrc?: string;
  steps?: {
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
  };
  tipText?: string;
  doneText?: string;
}

export default function TutorialModal({
  isOpen,
  onClose,
  title = 'Discord Auth Relay — Video Tutorial',
  subtitle = 'Step-by-step screen recording tutorial showing how to set up and use the auth relay.',
  videoSrc = '/tutorial.mp4',
  steps = {
    step1Title: '1. Enter Access PIN',
    step1Desc: 'Enter the PIN to open the live Discord authentication relay stream.',
    step2Title: '2. Log in to Discord',
    step2Desc: 'Attempt to log in to the Discord account. Discord will send a verification email.',
    step3Title: '3. Click "Verify Login"',
    step3Desc: 'The email will appear here instantly. Click the "Verify Login" (Verificar inicio de sesión) button.',
  },
  tipText = 'Tip: You can change the playback speed using the ⚡ Speed button.',
  doneText = 'Done',
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-[#313338] border border-[#383A40] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#2B2D31] border-b border-[#383A40]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#5865F2] flex items-center justify-center text-white shrink-0">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {title}
              </h3>
              <p className="text-xs text-[#949BA4]">
                {subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full bg-[#1E1F22] hover:bg-[#383A40] text-[#949BA4] hover:text-white flex items-center justify-center transition-colors border border-[#383A40]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body / Video Player */}
        <div className="p-4 sm:p-6 overflow-y-auto">
          <TutorialVideoPlayer
            src={videoSrc}
            title="Screen Record Walkthrough"
            autoPlay={true}
          />

          {/* Setup tips / Key instructions */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#DBDEE1]">
            <div className="bg-[#2B2D31] p-3 rounded-lg border border-[#383A40]">
              <span className="font-bold text-[#5865F2] block mb-1">{steps.step1Title}</span>
              <p className="text-[#949BA4] text-[11px] leading-relaxed">
                {steps.step1Desc}
              </p>
            </div>
            <div className="bg-[#2B2D31] p-3 rounded-lg border border-[#383A40]">
              <span className="font-bold text-[#23A55A] block mb-1">{steps.step2Title}</span>
              <p className="text-[#949BA4] text-[11px] leading-relaxed">
                {steps.step2Desc}
              </p>
            </div>
            <div className="bg-[#2B2D31] p-3 rounded-lg border border-[#383A40]">
              <span className="font-bold text-[#F0B232] block mb-1">{steps.step3Title}</span>
              <p className="text-[#949BA4] text-[11px] leading-relaxed">
                {steps.step3Desc}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[#2B2D31] border-t border-[#383A40] flex items-center justify-between text-xs text-[#949BA4]">
          <span>{tipText}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded font-medium bg-[#5865F2] hover:bg-[#4752C4] text-white transition-colors"
          >
            {doneText}
          </button>
        </div>
      </div>
    </div>
  );
}
