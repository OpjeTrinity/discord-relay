'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface AuthStatus {
  active: boolean;
  url?: string;
  ip?: string;
  location?: string;
  receivedAt?: string;
}

const POLL_INTERVAL = 4000;
const TTL_SECONDS = 900;

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function Home() {
  const [pin, setPin] = useState('');
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [consumed, setConsumed] = useState(false);
  const [copied, setCopied] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('discord_relay_pin');
    if (stored) setSavedPin(stored);
  }, []);

  const startCountdown = useCallback((receivedAt: string) => {
    const start = new Date(receivedAt).getTime();
    const updateCountdown = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = Math.max(0, TTL_SECONDS - elapsed);
      setCountdown(remaining);
      if (remaining === 0) {
        setAuthStatus({ active: false });
        if (countdownRef.current) clearInterval(countdownRef.current);
      }
    };
    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);
  }, []);

  const pollStatus = useCallback(async (currentPin: string) => {
    try {
      const res = await fetch('/api/auth-status', {
        headers: { 'x-access-pin': currentPin },
      });
      if (res.status === 401) {
        setSavedPin(null);
        localStorage.removeItem('discord_relay_pin');
        setPinError('Invalid access PIN');
        return;
      }
      const data: AuthStatus = await res.json();
      setAuthStatus(data);
      if (data.active && data.receivedAt) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        startCountdown(data.receivedAt);
      }
    } catch {
      // Keep polling silently
    }
  }, [startCountdown]);

  useEffect(() => {
    if (!savedPin) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }
    pollStatus(savedPin);
    pollingRef.current = setInterval(() => pollStatus(savedPin), POLL_INTERVAL);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [savedPin, pollStatus]);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setPinError('');
    setIsLoading(true);
    setSavedPin(pin.trim());
    localStorage.setItem('discord_relay_pin', pin.trim());
    setTimeout(() => setIsLoading(false), 500);
  };

  const handleAuthorize = async () => {
    if (!authStatus?.url || !savedPin) return;
    window.open(authStatus.url, '_blank', 'noopener,noreferrer');
    setConsumed(true);
    setAuthStatus({ active: false });
    if (countdownRef.current) clearInterval(countdownRef.current);
    try {
      await fetch('/api/consume-auth', {
        method: 'POST',
        headers: { 'x-access-pin': savedPin },
      });
    } catch {
      // best-effort
    }
  };

  const handleCopyCode = (codeText: string) => {
    const rawDigits = codeText.replace(/[^0-9]/g, '');
    navigator.clipboard.writeText(rawDigits || codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    setSavedPin(null);
    localStorage.removeItem('discord_relay_pin');
    setAuthStatus(null);
    setConsumed(false);
    setPin('');
  };

  // ─────────────────────────────────────────────────────────────
  // Material 3 Expressive: PIN Entry View
  // ─────────────────────────────────────────────────────────────
  if (!savedPin) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#101216] text-[#e2e2e9]">
        <div className="w-full max-w-md rounded-[32px] p-8 sm:p-10 bg-[#1b1d22] border border-[#2d3037] shadow-2xl transition-all duration-300">
          {/* Header Icon & Title */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-[24px] bg-[#2e4190]/35 border border-[#b8c4ff]/25 flex items-center justify-center text-[#b8c4ff] shadow-inner mb-5">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="3" ry="3" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#e2e2e9] mb-2">
              Discord Auth Relay
            </h1>
            <p className="text-sm text-[#c3c6cf] max-w-xs leading-relaxed">
              Enter your access PIN to monitor and authorize incoming login requests.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#c3c6cf] tracking-wide uppercase px-1">
                Access PIN
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter your security PIN"
                  autoFocus
                  className="w-full rounded-[20px] px-5 py-4 text-base text-[#e2e2e9] bg-[#101216] border border-[#43474e] focus:border-[#b8c4ff] focus:ring-2 focus:ring-[#b8c4ff]/30 outline-none transition-all placeholder:text-[#8d9199]"
                />
              </div>
              {pinError && (
                <p className="text-xs text-[#ffb4ab] px-2 flex items-center gap-1.5 pt-1">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {pinError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !pin.trim()}
              className="w-full py-4 rounded-full font-semibold text-sm tracking-wide bg-[#b8c4ff] text-[#122878] hover:bg-[#c9d4ff] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-[#b8c4ff]/10 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-[#122878]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying PIN...
                </>
              ) : (
                'Continue to Dashboard'
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-8 text-center">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#24272d] text-[#8d9199] border border-[#33353a]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7ce09b]" />
              Secured Relay Gateway
            </span>
          </div>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Material 3 Expressive: Dashboard View
  // ─────────────────────────────────────────────────────────────
  const isGmailCode = authStatus?.ip?.toLowerCase().includes('gmail code');

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[#101216] text-[#e2e2e9]">
      {/* Top App Bar */}
      <header className="w-full max-w-xl flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#2e4190]/40 border border-[#b8c4ff]/30 flex items-center justify-center text-[#b8c4ff]">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14h-2v-2h2zm0-4h-2V7h2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-[#e2e2e9] tracking-tight">Discord Auth Relay</h1>
            <p className="text-xs text-[#8d9199]">Real-time Webhook Receiver</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-[#24272d] text-[#c3c6cf] hover:bg-[#2d3037] hover:text-[#e2e2e9] active:scale-95 transition-all border border-[#33353a]"
          title="Sign out"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </header>

      {/* Main Material 3 Expressive Card */}
      <div className="w-full max-w-xl rounded-[36px] p-6 sm:p-9 bg-[#1b1d22] border border-[#2d3037] shadow-2xl relative overflow-hidden transition-all duration-300">
        {consumed ? (
          /* Consumed / Authorized State */
          <div className="flex flex-col items-center text-center py-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-[#005328]/40 border border-[#7ce09b]/40 flex items-center justify-center text-[#7ce09b] shadow-lg shadow-[#005328]/30 mb-2">
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#e2e2e9] tracking-tight">Login Authorized</h2>
            <p className="text-sm text-[#c3c6cf] max-w-sm leading-relaxed">
              The verification request was processed and the link was launched. Your Discord session should now be unlocked.
            </p>
            <button
              onClick={() => setConsumed(false)}
              className="mt-4 px-6 py-3 rounded-full text-sm font-semibold bg-[#24272d] text-[#e2e2e9] hover:bg-[#2d3037] active:scale-95 transition-all border border-[#33353a]"
            >
              Return to Monitoring
            </button>
          </div>
        ) : authStatus?.active ? (
          /* Active Verification Request State */
          <div className="space-y-6">
            {/* Status & Countdown Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#005328]/40 text-[#99fdb6] border border-[#7ce09b]/30">
                <span className="w-2 h-2 rounded-full bg-[#7ce09b] animate-ping" />
                Action Required
              </div>

              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-medium bg-[#24272d] text-[#c3c6cf] border border-[#33353a]">
                <svg className="w-3.5 h-3.5 text-[#ffb77c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Expires in: <span className={countdown < 60 ? 'text-[#ffb4ab] font-bold' : 'text-[#ffb77c] font-bold'}>{formatCountdown(countdown)}</span>
              </div>
            </div>

            {/* Request Summary Cards */}
            <div className="rounded-[28px] p-5 sm:p-6 bg-[#101216] border border-[#2d3037] space-y-4">
              {/* Target / IP Details */}
              <div className="flex items-center justify-between py-2 border-b border-[#24272d]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#24272d] flex items-center justify-center text-[#b8c4ff]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-[#8d9199] uppercase tracking-wider">
                    {isGmailCode ? 'Verification Code' : 'IP Address'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base font-mono font-semibold text-[#e2e2e9]">
                    {authStatus.ip ?? 'Unknown'}
                  </span>
                  {isGmailCode && (
                    <button
                      onClick={() => handleCopyCode(authStatus.ip || '')}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#2e4190] text-[#dce1ff] hover:bg-[#3b51b3] active:scale-95 transition-all"
                      title="Copy code"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="flex items-center justify-between py-2 border-b border-[#24272d]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#24272d] flex items-center justify-center text-[#ffb77c]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-[#8d9199] uppercase tracking-wider">Origin</span>
                </div>
                <span className="text-sm font-medium text-[#e2e2e9] text-right max-w-xs truncate">
                  {authStatus.location ?? 'Unknown'}
                </span>
              </div>

              {/* Timestamp */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#24272d] flex items-center justify-center text-[#c3c5dd]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 14 14" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-[#8d9199] uppercase tracking-wider">Received</span>
                </div>
                <span className="text-xs font-medium text-[#c3c6cf]">
                  {authStatus.receivedAt ? new Date(authStatus.receivedAt).toLocaleTimeString() : 'Just now'}
                </span>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleAuthorize}
              className="w-full py-4 rounded-full font-bold text-base tracking-wide bg-[#b8c4ff] text-[#122878] hover:bg-[#c9d4ff] active:scale-[0.98] transition-all shadow-lg shadow-[#b8c4ff]/20 flex items-center justify-center gap-2.5"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              {isGmailCode ? 'Open Verification Link' : 'Authorize Discord IP'}
            </button>
          </div>
        ) : (
          /* Waiting / Listening State */
          <div className="flex flex-col items-center text-center py-12 px-2 space-y-6">
            {/* Concentric Pulsing Radar Icon */}
            <div className="relative flex items-center justify-center w-24 h-24 mb-2">
              <div className="absolute inset-0 rounded-full bg-[#2e4190]/25 animate-ping opacity-60" />
              <div className="absolute -inset-2 rounded-full border border-[#b8c4ff]/20 animate-pulse-ring" />
              <div className="w-20 h-20 rounded-full bg-[#24272d] border border-[#33353a] flex items-center justify-center shadow-inner text-[#b8c4ff]">
                <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#e2e2e9] tracking-tight">
                Listening for Verification
              </h2>
              <p className="text-sm text-[#8d9199] max-w-sm mx-auto leading-relaxed">
                Trigger a login on Discord or submit a verification email. Incoming authorization requests will appear here instantly.
              </p>
            </div>

            {/* Live Status Pill */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-medium bg-[#101216] border border-[#2d3037] text-[#c3c6cf]">
              <span className="w-2 h-2 rounded-full bg-[#7ce09b] animate-pulse" />
              Live relay active • Polling every 4s
            </div>
          </div>
        )}
      </div>

      {/* Subtitle Info */}
      <footer className="mt-8 text-center text-xs text-[#8d9199] flex items-center gap-3">
        <span>Upstash Redis TTL (15m)</span>
        <span>•</span>
        <span>Material 3 Expressive UI</span>
      </footer>
    </main>
  );
}
