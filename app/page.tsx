'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface AuthStatus {
  active: boolean;
  subject?: string;
  from?: string;
  html?: string;
  plain?: string;
  code?: string;
  receivedAt?: string;
}

const POLL_INTERVAL = 1500; // 1.5 seconds

function DiscordLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
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
  const [viewMode, setViewMode] = useState<'rendered' | 'plain'>('rendered');
  const [copied, setCopied] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('discord_relay_pin');
    if (stored) setSavedPin(stored);
  }, []);

  const pollStatus = useCallback(async (currentPin: string) => {
    try {
      const res = await fetch('/api/auth-status', {
        headers: { 'x-access-pin': currentPin },
        cache: 'no-store',
      });
      if (res.status === 401) {
        setSavedPin(null);
        localStorage.removeItem('discord_relay_pin');
        setPinError('Invalid access PIN.');
        return;
      }
      const data: AuthStatus = await res.json();
      setAuthStatus(data);
    } catch {
      // silently retry
    }
  }, []);

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

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setPinError('');
    setIsLoading(true);
    setSavedPin(pin.trim());
    localStorage.setItem('discord_relay_pin', pin.trim());
    setTimeout(() => setIsLoading(false), 300);
  };

  const handleClear = async () => {
    if (!savedPin) return;
    setAuthStatus({ active: false });
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
    setPin('');
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─────────────────────────────────────────────────────────────
  // Discord Themed: PIN Login Screen
  // ─────────────────────────────────────────────────────────────
  if (!savedPin) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-[#1E1F22]">
        <div className="w-full max-w-[480px] rounded-lg p-8 bg-[#313338] shadow-2xl border border-[#383A40]">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <DiscordLogo size={48} />
            <h1 className="text-2xl font-bold text-[#F2F3F5] tracking-tight mt-4">
              Welcome back!
            </h1>
            <p className="text-sm text-[#B5BAC1] mt-1">
              Enter your access PIN to monitor the Discord Auth Relay.
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-[#B5BAC1] uppercase tracking-wider mb-2">
                Access PIN <span className="text-[#F23F43]">*</span>
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN..."
                autoFocus
                className="w-full rounded-[4px] px-3 py-2.5 text-base text-[#F2F3F5] bg-[#1E1F22] border border-[#2B2D31] focus:border-[#5865F2] outline-none transition-colors placeholder:text-[#4E5058]"
              />
              {pinError && (
                <p className="text-xs text-[#F23F43] mt-1.5 font-medium">{pinError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !pin.trim()}
              className="w-full py-2.5 rounded-[4px] font-medium text-sm text-white bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Verifying...' : 'Log In'}
            </button>
          </form>

          <p className="text-xs text-[#949BA4] text-center mt-6">
            Default PIN: <code className="bg-[#1E1F22] px-1.5 py-0.5 rounded text-[#DBDEE1]">changeme</code> (configured in <code className="text-[#5865F2]">.env.local</code>)
          </p>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Discord Themed: Main App & Email Viewer
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[#1E1F22] text-[#DBDEE1]">
      {/* Discord Top Navigation Bar */}
      <header className="h-12 bg-[#2B2D31] border-b border-[#1F2023] px-4 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <span className="text-[#80848E] font-bold text-xl">#</span>
          <span className="font-semibold text-white text-sm tracking-wide">discord-auth-relay</span>
          <span className="text-xs text-[#949BA4] hidden sm:inline-block border-l border-[#3F4147] pl-2.5 ml-1">
            Realtime Inbox &amp; Verification Stream
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#1E1F22] text-xs">
            <span className="w-2 h-2 rounded-full bg-[#23A55A] animate-pulse" />
            <span className="text-[#949BA4]">Listening (1.5s)</span>
          </div>

          <button
            onClick={handleLogout}
            className="px-2.5 py-1 rounded text-xs font-medium bg-[#35373C] hover:bg-[#3F4147] text-[#DBDEE1] transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {authStatus?.active ? (
          /* When Email has Arrived */
          <div className="flex flex-col gap-4">
            {/* Header / Notice */}
            <div className="flex items-center justify-between flex-wrap gap-2 bg-[#2B2D31] p-4 rounded-lg border border-[#383A40]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white shrink-0 shadow">
                  <DiscordLogo size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">Discord System</span>
                    <span className="bg-[#5865F2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                      BOT
                    </span>
                    <span className="text-xs text-[#949BA4]">
                      {authStatus.receivedAt ? new Date(authStatus.receivedAt).toLocaleTimeString() : 'Just now'}
                    </span>
                  </div>
                  <p className="text-sm text-[#DBDEE1] font-medium mt-0.5">
                    {authStatus.subject ?? 'New Notification from Discord'}
                  </p>
                </div>
              </div>

              {/* Action buttons on header */}
              <div className="flex items-center gap-2">
                <div className="flex rounded bg-[#1E1F22] p-0.5 border border-[#383A40] text-xs">
                  <button
                    onClick={() => setViewMode('rendered')}
                    className={`px-3 py-1 rounded font-medium transition-colors ${
                      viewMode === 'rendered'
                        ? 'bg-[#5865F2] text-white'
                        : 'text-[#949BA4] hover:text-white'
                    }`}
                  >
                    HTML View
                  </button>
                  <button
                    onClick={() => setViewMode('plain')}
                    className={`px-3 py-1 rounded font-medium transition-colors ${
                      viewMode === 'plain'
                        ? 'bg-[#5865F2] text-white'
                        : 'text-[#949BA4] hover:text-white'
                    }`}
                  >
                    Plain Text
                  </button>
                </div>

                <button
                  onClick={handleClear}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-[#DA373C] hover:bg-[#A12828] text-white transition-colors"
                >
                  Clear Email
                </button>
              </div>
            </div>

            {/* If Gmail Code exists, show quick-copy banner */}
            {authStatus.code && (
              <div className="bg-[#2B2D31] border-l-4 border-l-[#23A55A] p-4 rounded-r-lg flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#23A55A]">
                    Gmail Confirmation Code Detected
                  </span>
                  <div className="text-xl font-mono font-bold text-white mt-1">
                    {authStatus.code}
                  </div>
                </div>
                <button
                  onClick={() => handleCopyCode(authStatus.code || '')}
                  className="px-4 py-2 rounded font-medium text-sm text-white bg-[#23A55A] hover:bg-[#1C8B4C] transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
            )}

            {/* Email Body Container (Discord Embed style) */}
            <div className="bg-[#2B2D31] rounded-lg border-l-4 border-l-[#5865F2] border border-[#383A40] shadow-xl overflow-hidden">
              <div className="px-4 py-3 bg-[#242629] border-b border-[#313338] flex items-center justify-between text-xs text-[#949BA4]">
                <div>
                  <span className="font-semibold text-[#DBDEE1]">From:</span> {authStatus.from ?? 'Discord <noreply@discord.com>'}
                </div>
                <div className="italic">
                  Displaying full unmodified email content
                </div>
              </div>

              {viewMode === 'rendered' && authStatus.html ? (
                <div className="p-3 bg-white">
                  <iframe
                    srcDoc={authStatus.html}
                    title="Discord Email Preview"
                    className="w-full min-h-[580px] h-full border-0 bg-white"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  />
                </div>
              ) : (
                <div className="p-4 bg-[#1E1F22] overflow-x-auto">
                  <pre className="font-mono text-xs sm:text-sm text-[#DBDEE1] whitespace-pre-wrap leading-relaxed">
                    {authStatus.plain || authStatus.html || 'No readable body provided'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Empty / Waiting for Email State (Styled like Discord Channel Welcome) */
          <div className="flex flex-col items-center justify-center text-center py-20 px-4">
            <div className="w-20 h-20 rounded-full bg-[#2B2D31] border border-[#383A40] flex items-center justify-center mb-6 text-[#5865F2] shadow-lg">
              <DiscordLogo size={42} />
            </div>

            <h2 className="text-2xl font-bold text-white tracking-tight">
              Welcome to #discord-auth-relay!
            </h2>
            <p className="text-sm text-[#949BA4] max-w-md mt-2 leading-relaxed">
              This is the start of your relay. As soon as Discord sends a login verification email or Gmail sends a forward, the <strong>entire unmodified email</strong> will appear right here.
            </p>

            <div className="mt-8 flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#2B2D31] border border-[#383A40] text-xs font-medium text-[#DBDEE1]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#23A55A] animate-ping" />
              <span>Waiting for email from Discord... (polling active)</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
