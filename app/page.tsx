'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface AuthStatus {
  active: boolean;
  url?: string;
  ip?: string;
  location?: string;
  receivedAt?: string;
}

const POLL_INTERVAL = 4000; // 4 seconds
const TTL_SECONDS = 900; // 15 minutes

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function DiscordLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z"
        fill="#5865F2"
      />
    </svg>
  );
}

export default function Home() {
  const [pin, setPin] = useState('');
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [consumed, setConsumed] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore pin from localStorage on mount
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
        setPinError('Invalid PIN. Please try again.');
        return;
      }
      const data: AuthStatus = await res.json();
      setAuthStatus(data);
      if (data.active && data.receivedAt) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        startCountdown(data.receivedAt);
      }
    } catch {
      // Network error — keep polling silently
    }
  }, [startCountdown]);

  // Start/stop polling based on pin availability
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

  // Cleanup countdown on unmount
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
    setTimeout(() => setIsLoading(false), 1000);
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

  const handleLogout = () => {
    setSavedPin(null);
    localStorage.removeItem('discord_relay_pin');
    setAuthStatus(null);
    setConsumed(false);
    setPin('');
  };

  // ── PIN Gate ──────────────────────────────────────────────────
  if (!savedPin) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#1E1F22' }}>
        <div
          className="w-full max-w-sm rounded-xl p-8 shadow-2xl"
          style={{ backgroundColor: '#2B2D31', border: '1px solid #3D3F45' }}
        >
          <div className="flex flex-col items-center gap-3 mb-8">
            <DiscordLogo />
            <h1 className="text-xl font-bold text-white tracking-tight">Discord Auth Relay</h1>
            <p className="text-sm text-center" style={{ color: '#B5BAC1' }}>
              Enter your access PIN to continue
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#B5BAC1' }}>
                Access PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN..."
                autoFocus
                className="w-full rounded-md px-3 py-2.5 text-sm text-white outline-none focus:ring-2 transition"
                style={{
                  backgroundColor: '#1E1F22',
                  border: pinError ? '1px solid #ED4245' : '1px solid #3D3F45',
                  color: '#DBDEE1',
                }}
              />
              {pinError && <p className="text-xs" style={{ color: '#ED4245' }}>{pinError}</p>}
            </div>
            <button
              type="submit"
              disabled={isLoading || !pin.trim()}
              className="w-full py-2.5 rounded-md text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: '#5865F2' }}
            >
              {isLoading ? 'Verifying...' : 'Enter Dashboard'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: '#1E1F22' }}>
      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <DiscordLogo />
          <span className="font-bold text-white text-lg">Discord Auth Relay</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs px-3 py-1.5 rounded-md transition"
          style={{ color: '#B5BAC1', backgroundColor: '#313338' }}
        >
          Sign out
        </button>
      </div>

      {/* Main card */}
      <div
        className="w-full max-w-lg rounded-xl p-6 shadow-2xl"
        style={{ backgroundColor: '#2B2D31', border: '1px solid #3D3F45' }}
      >
        {consumed ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="text-5xl">✅</div>
            <h2 className="text-lg font-bold text-white">Login Authorized</h2>
            <p className="text-sm text-center" style={{ color: '#B5BAC1' }}>
              The Discord verification link was opened. The session should now be authorized.
            </p>
            <button
              onClick={() => setConsumed(false)}
              className="mt-2 text-xs px-4 py-2 rounded-md"
              style={{ backgroundColor: '#313338', color: '#B5BAC1' }}
            >
              Back to Dashboard
            </button>
          </div>
        ) : authStatus?.active ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: '#57F287', boxShadow: '0 0 6px #57F287' }}
              />
              <span className="text-sm font-semibold" style={{ color: '#57F287' }}>
                Verification Link Ready
              </span>
            </div>

            <div className="rounded-lg p-4 flex flex-col gap-3" style={{ backgroundColor: '#313338' }}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#B5BAC1' }}>
                  IP Address
                </span>
                <span className="text-sm font-mono text-white">{authStatus.ip ?? 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#B5BAC1' }}>
                  Location
                </span>
                <span className="text-sm text-white">{authStatus.location ?? 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#B5BAC1' }}>
                  Received
                </span>
                <span className="text-sm text-white">
                  {authStatus.receivedAt ? new Date(authStatus.receivedAt).toLocaleTimeString() : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#B5BAC1' }}>
                  Expires In
                </span>
                <span
                  className={`text-sm font-mono font-bold countdown-anim ${countdown < 60 ? 'text-red-400' : ''}`}
                  style={countdown >= 60 ? { color: '#FAA61A' } : {}}
                >
                  {formatCountdown(countdown)}
                </span>
              </div>
            </div>

            <button
              onClick={handleAuthorize}
              className="pulse-btn w-full py-3.5 rounded-lg text-base font-bold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: '#5865F2' }}
            >
              🔓 Authorize Discord IP Now
            </button>

            <p className="text-xs text-center" style={{ color: '#80848E' }}>
              This will open the Discord verification link in a new tab and mark it as used.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 py-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#313338' }}
            >
              <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#5865F2" strokeWidth="3" />
                <path
                  className="opacity-75"
                  fill="#5865F2"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="text-base font-bold text-white">Waiting for Verification Email</h2>
              <p className="text-sm max-w-xs" style={{ color: '#B5BAC1' }}>
                Trigger a login on Discord from a new location, then wait ~10 seconds for the email to arrive.
              </p>
            </div>
            <div
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ backgroundColor: '#313338', color: '#80848E' }}
            >
              Polling every 4s…
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs" style={{ color: '#4E5058' }}>
        Links auto-expire after 15 minutes • Secured with PIN authentication
      </p>
    </main>
  );
}
