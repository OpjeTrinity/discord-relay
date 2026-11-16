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

type Language = 'en' | 'es' | 'hi' | 'pt' | 'fr' | 'de';

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

const TRANSLATIONS: Record<Language, {
  channelTitle: string;
  channelSubtitle: string;
  listening: string;
  signOut: string;
  welcomeBack: string;
  pinSubtitle: string;
  pinLabel: string;
  pinPlaceholder: string;
  pinError: string;
  logIn: string;
  verifying: string;
  defaultPinNote: string;
  discordSystem: string;
  botBadge: string;
  justNow: string;
  newNotification: string;
  htmlView: string;
  plainText: string;
  clearEmail: string;
  gmailDetected: string;
  copyCode: string;
  copied: string;
  from: string;
  displayNote: string;
  welcomeHeading: string;
  welcomeSubtext: string;
  waitingPill: string;
}> = {
  en: {
    channelTitle: 'discord-auth-relay',
    channelSubtitle: 'Realtime Inbox & Verification Stream',
    listening: 'Listening (1.5s)',
    signOut: 'Sign Out',
    welcomeBack: 'Welcome back!',
    pinSubtitle: 'Enter your access PIN to monitor the Discord Auth Relay.',
    pinLabel: 'Access PIN',
    pinPlaceholder: 'Enter PIN...',
    pinError: 'Invalid access PIN.',
    logIn: 'Log In',
    verifying: 'Verifying...',
    defaultPinNote: 'Default PIN:',
    discordSystem: 'Discord System',
    botBadge: 'BOT',
    justNow: 'Just now',
    newNotification: 'New Notification from Discord',
    htmlView: 'HTML View',
    plainText: 'Plain Text',
    clearEmail: 'Clear Email',
    gmailDetected: 'Gmail Confirmation Code Detected',
    copyCode: 'Copy Code',
    copied: 'Copied!',
    from: 'From:',
    displayNote: 'Displaying full unmodified email content',
    welcomeHeading: 'Welcome to #discord-auth-relay!',
    welcomeSubtext:
      'This is the start of your relay. As soon as Discord sends a login verification email or Gmail sends a forward, the entire unmodified email will appear right here.',
    waitingPill: 'Waiting for email from Discord... (polling active)',
  },
  es: {
    channelTitle: 'discord-auth-relay',
    channelSubtitle: 'Bandeja de entrada y flujo de verificación en tiempo real',
    listening: 'Escuchando (1.5s)',
    signOut: 'Cerrar sesión',
    welcomeBack: '¡Te damos la bienvenida!',
    pinSubtitle: 'Introduce tu PIN de acceso para monitorear el retransmisor de Discord.',
    pinLabel: 'PIN DE ACCESO',
    pinPlaceholder: 'Introduce el PIN...',
    pinError: 'PIN de acceso no válido.',
    logIn: 'Iniciar sesión',
    verifying: 'Verificando...',
    defaultPinNote: 'PIN predeterminado:',
    discordSystem: 'Sistema de Discord',
    botBadge: 'BOT',
    justNow: 'Hace un momento',
    newNotification: 'Nueva notificación de Discord',
    htmlView: 'Vista HTML',
    plainText: 'Texto sin formato',
    clearEmail: 'Borrar correo',
    gmailDetected: 'Código de confirmación de Gmail detectado',
    copyCode: 'Copiar código',
    copied: '¡Copiado!',
    from: 'De:',
    displayNote: 'Mostrando el contenido completo del correo sin modificaciones',
    welcomeHeading: '¡Te damos la bienvenida a #discord-auth-relay!',
    welcomeSubtext:
      'Este es el inicio de tu retransmisor. En cuanto Discord envíe un correo de verificación o Gmail lo reenvíe, el correo completo aparecerá aquí mismo.',
    waitingPill: 'Esperando correo de Discord... (escucha activa)',
  },
  hi: {
    channelTitle: 'discord-auth-relay',
    channelSubtitle: 'रीयल-टाइम इनबॉक्स और सत्यापन स्ट्रीम',
    listening: 'सक्रिय (1.5s)',
    signOut: 'साइन आउट',
    welcomeBack: 'वापसी पर स्वागत है!',
    pinSubtitle: 'डिस्कॉर्ड ऑथ रिले की निगरानी के लिए अपना सुरक्षा पिन दर्ज करें।',
    pinLabel: 'सुरक्षा पिन (ACCESS PIN)',
    pinPlaceholder: 'पिन दर्ज करें...',
    pinError: 'अमान्य एक्सेस पिन।',
    logIn: 'लॉग इन करें',
    verifying: 'सत्यापित किया जा रहा है...',
    defaultPinNote: 'डिफ़ॉल्ट पिन:',
    discordSystem: 'डिस्कॉर्ड सिस्टम',
    botBadge: 'BOT',
    justNow: 'अभी-अभी',
    newNotification: 'डिस्कॉर्ड से नई सूचना',
    htmlView: 'HTML दृश्य',
    plainText: 'सादा पाठ',
    clearEmail: 'ईमेल हटाएं',
    gmailDetected: 'जीमेल पुष्टिकरण कोड प्राप्त हुआ',
    copyCode: 'कोड कॉपी करें',
    copied: 'कॉपी हो गया!',
    from: 'प्रेषक:',
    displayNote: 'मूल और असंशोधित ईमेल प्रदर्शित किया जा रहा है',
    welcomeHeading: '#discord-auth-relay में आपका स्वागत है!',
    welcomeSubtext:
      'यह आपके रिले की शुरुआत है। जैसे ही डिस्कॉर्ड सत्यापन ईमेल भेजेगा, पूरा ईमेल यहां प्रदर्शित होगा।',
    waitingPill: 'डिस्कॉर्ड ईमेल की प्रतीक्षा कर रहा है...',
  },
  pt: {
    channelTitle: 'discord-auth-relay',
    channelSubtitle: 'Caixa de entrada e fluxo de verificação em tempo real',
    listening: 'Escutando (1.5s)',
    signOut: 'Sair',
    welcomeBack: 'Boas-vindas de volta!',
    pinSubtitle: 'Digite seu PIN de acesso para monitorar o Discord Auth Relay.',
    pinLabel: 'PIN DE ACESSO',
    pinPlaceholder: 'Digite o PIN...',
    pinError: 'PIN de acesso inválido.',
    logIn: 'Entrar',
    verifying: 'Verificando...',
    defaultPinNote: 'PIN padrão:',
    discordSystem: 'Sistema do Discord',
    botBadge: 'BOT',
    justNow: 'Agora mesmo',
    newNotification: 'Nova notificação do Discord',
    htmlView: 'Visualização HTML',
    plainText: 'Texto simples',
    clearEmail: 'Limpar e-mail',
    gmailDetected: 'Código de confirmação do Gmail detectado',
    copyCode: 'Copiar código',
    copied: 'Copiado!',
    from: 'De:',
    displayNote: 'Exibindo o conteúdo completo e original do e-mail',
    welcomeHeading: 'Boas-vindas ao #discord-auth-relay!',
    welcomeSubtext:
      'Este é o início do seu relay. Assim que o Discord enviar um e-mail de verificação, o e-mail completo aparecerá aqui.',
    waitingPill: 'Aguardando e-mail do Discord... (polling ativo)',
  },
  fr: {
    channelTitle: 'discord-auth-relay',
    channelSubtitle: 'Boîte de réception et flux de vérification en direct',
    listening: 'En écoute (1.5s)',
    signOut: 'Déconnexion',
    welcomeBack: 'Bon retour !',
    pinSubtitle: 'Saisissez votre code PIN pour surveiller le relais Discord.',
    pinLabel: 'CODE PIN D\'ACCÈS',
    pinPlaceholder: 'Entrez le code PIN...',
    pinError: 'Code PIN invalide.',
    logIn: 'Connexion',
    verifying: 'Vérification...',
    defaultPinNote: 'PIN par défaut :',
    discordSystem: 'Système Discord',
    botBadge: 'BOT',
    justNow: 'À l\'instant',
    newNotification: 'Nouvelle notification Discord',
    htmlView: 'Vue HTML',
    plainText: 'Texte brut',
    clearEmail: 'Effacer l\'e-mail',
    gmailDetected: 'Code de confirmation Gmail détecté',
    copyCode: 'Copier le code',
    copied: 'Copié !',
    from: 'De :',
    displayNote: 'Affichage du contenu complet de l\'e-mail sans modification',
    welcomeHeading: 'Bienvenue sur #discord-auth-relay !',
    welcomeSubtext:
      'Voici le début de votre relais. Dès que Discord enverra un e-mail de vérification, le message entier s\'affichera ici.',
    waitingPill: 'En attente d\'un e-mail de Discord...',
  },
  de: {
    channelTitle: 'discord-auth-relay',
    channelSubtitle: 'Echtzeit-Posteingang & Verifizierungsstream',
    listening: 'Aktiv (1.5s)',
    signOut: 'Abmelden',
    welcomeBack: 'Willkommen zurück!',
    pinSubtitle: 'Gib deine Zugangs-PIN ein, um den Discord-Auth-Relay zu überwachen.',
    pinLabel: 'ZUGANGS-PIN',
    pinPlaceholder: 'PIN eingeben...',
    pinError: 'Ungültige PIN.',
    logIn: 'Anmelden',
    verifying: 'Wird überprüft...',
    defaultPinNote: 'Standard-PIN:',
    discordSystem: 'Discord-System',
    botBadge: 'BOT',
    justNow: 'Gerade eben',
    newNotification: 'Neue Benachrichtigung von Discord',
    htmlView: 'HTML-Ansicht',
    plainText: 'Klartext',
    clearEmail: 'E-Mail löschen',
    gmailDetected: 'Gmail-Bestätigungscode erkannt',
    copyCode: 'Code kopieren',
    copied: 'Kopiert!',
    from: 'Von:',
    displayNote: 'Vollständiger, unveränderter E-Mail-Inhalt wird angezeigt',
    welcomeHeading: 'Willkommen bei #discord-auth-relay!',
    welcomeSubtext:
      'Dies ist der Anfang deines Relays. Sobald Discord eine E-Mail sendet, wird sie hier angezeigt.',
    waitingPill: 'Warte auf Discord-E-Mail...',
  },
};

function detectLocationLanguage(): Language {
  if (typeof window === 'undefined') return 'en';

  const saved = localStorage.getItem('discord_relay_lang') as Language;
  if (saved && TRANSLATIONS[saved]) return saved;

  // 1. Browser language detection
  const browserLang = (navigator.language || '').toLowerCase();
  if (browserLang.startsWith('es')) return 'es';
  if (browserLang.startsWith('hi')) return 'hi';
  if (browserLang.startsWith('pt')) return 'pt';
  if (browserLang.startsWith('fr')) return 'fr';
  if (browserLang.startsWith('de')) return 'de';

  // 2. Timezone / Location detection for Spanish countries
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const spanishTimezones = [
      'Mexico', 'Cancun', 'Merida', 'Monterrey', 'Mazatlan', 'Chihuahua', 'Hermosillo', 'Tijuana',
      'Bahia_Banderas', 'Matamoros', 'Ojinaga',
      'Madrid', 'Buenos_Aires', 'Bogota', 'Santiago', 'Lima', 'Caracas',
      'Montevideo', 'La_Paz', 'Asuncion', 'Guayaquil', 'Panama', 'San_Jose', 'Guatemala',
      'Havana', 'Santo_Domingo', 'Tegucigalpa', 'Managua', 'San_Salvador'
    ];
    if (spanishTimezones.some((stz) => tz.includes(stz))) return 'es';
  } catch {
    // ignore
  }

  return 'en';
}

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
  const [lang, setLang] = useState<Language>('en');
  const [pin, setPin] = useState('');
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [viewMode, setViewMode] = useState<'rendered' | 'plain'>('rendered');
  const [copied, setCopied] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize Language based on location/locale on mount
  useEffect(() => {
    // 1. Instant client-side detection via browser locale & timezone
    const detected = detectLocationLanguage();
    setLang(detected);

    // 2. Server IP Geo-location detection via Vercel edge headers
    const userStoredLang = localStorage.getItem('discord_relay_lang');
    if (!userStoredLang) {
      fetch('/api/geo')
        .then((res) => res.json())
        .then((geo) => {
          const country = (geo.country || '').toUpperCase();
          const spanishCountries = [
            'MX', 'ES', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT',
            'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PR', 'PA', 'UY'
          ];
          if (spanishCountries.includes(country)) {
            setLang('es');
          } else if (country === 'BR' || country === 'PT') {
            setLang('pt');
          } else if (country === 'FR') {
            setLang('fr');
          } else if (country === 'DE' || country === 'AT' || country === 'CH') {
            setLang('de');
          }
        })
        .catch(() => {});
    }

    const stored = localStorage.getItem('discord_relay_pin');
    if (stored) setSavedPin(stored);
  }, []);

  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('discord_relay_lang', newLang);
  };

  const pollStatus = useCallback(async (currentPin: string) => {
    try {
      const res = await fetch('/api/auth-status', {
        headers: { 'x-access-pin': currentPin },
        cache: 'no-store',
      });
      if (res.status === 401) {
        setSavedPin(null);
        localStorage.removeItem('discord_relay_pin');
        setPinError(t.pinError);
        return;
      }
      const data: AuthStatus = await res.json();
      setAuthStatus(data);

      // Auto-switch to Spanish if email subject/body is in Spanish and user hasn't explicitly set a language
      if (data.active && data.subject) {
        const subjectLower = data.subject.toLowerCase();
        if (
          (subjectLower.includes('verifica') || subjectLower.includes('sesión') || subjectLower.includes('ubicación')) &&
          !localStorage.getItem('discord_relay_lang')
        ) {
          setLang('es');
        }
      }
    } catch {
      // silently retry
    }
  }, [t.pinError]);

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
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#1E1F22] text-[#DBDEE1]">
        {/* Language selector on login screen */}
        <div className="w-full max-w-[480px] flex justify-end mb-3">
          <div className="flex items-center gap-1.5 bg-[#2B2D31] px-2 py-1 rounded text-xs border border-[#383A40]">
            <span className="text-sm">🌐</span>
            <select
              value={lang}
              onChange={(e) => handleLanguageChange(e.target.value as Language)}
              className="bg-transparent text-[#DBDEE1] outline-none text-xs cursor-pointer"
            >
              {LANGUAGES.map((item) => (
                <option key={item.code} value={item.code} className="bg-[#2B2D31] text-white">
                  {item.flag} {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full max-w-[480px] rounded-lg p-8 bg-[#313338] shadow-2xl border border-[#383A40]">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <DiscordLogo size={48} />
            <h1 className="text-2xl font-bold text-[#F2F3F5] tracking-tight mt-4">
              {t.welcomeBack}
            </h1>
            <p className="text-sm text-[#B5BAC1] mt-1">
              {t.pinSubtitle}
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-[#B5BAC1] uppercase tracking-wider mb-2">
                {t.pinLabel} <span className="text-[#F23F43]">*</span>
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder={t.pinPlaceholder}
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
              {isLoading ? t.verifying : t.logIn}
            </button>
          </form>

          <p className="text-xs text-[#949BA4] text-center mt-6">
            {t.defaultPinNote} <code className="bg-[#1E1F22] px-1.5 py-0.5 rounded text-[#DBDEE1]">changeme</code> (<code className="text-[#5865F2]">.env.local</code>)
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
          <span className="font-semibold text-white text-sm tracking-wide">{t.channelTitle}</span>
          <span className="text-xs text-[#949BA4] hidden sm:inline-block border-l border-[#3F4147] pl-2.5 ml-1">
            {t.channelSubtitle}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Language Selector Dropdown */}
          <div className="flex items-center gap-1 bg-[#1E1F22] px-2 py-1 rounded text-xs border border-[#383A40]">
            <span className="text-xs">🌐</span>
            <select
              value={lang}
              onChange={(e) => handleLanguageChange(e.target.value as Language)}
              className="bg-transparent text-[#DBDEE1] outline-none text-xs cursor-pointer font-medium"
            >
              {LANGUAGES.map((item) => (
                <option key={item.code} value={item.code} className="bg-[#2B2D31] text-white">
                  {item.flag} {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-[#1E1F22] text-xs">
            <span className="w-2 h-2 rounded-full bg-[#23A55A] animate-pulse" />
            <span className="text-[#949BA4]">{t.listening}</span>
          </div>

          <button
            onClick={handleLogout}
            className="px-2.5 py-1 rounded text-xs font-medium bg-[#35373C] hover:bg-[#3F4147] text-[#DBDEE1] transition-colors"
          >
            {t.signOut}
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
                    <span className="font-bold text-white text-base">{t.discordSystem}</span>
                    <span className="bg-[#5865F2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {t.botBadge}
                    </span>
                    <span className="text-xs text-[#949BA4]">
                      {authStatus.receivedAt ? new Date(authStatus.receivedAt).toLocaleTimeString() : t.justNow}
                    </span>
                  </div>
                  <p className="text-sm text-[#DBDEE1] font-medium mt-0.5">
                    {authStatus.subject ?? t.newNotification}
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
                    {t.htmlView}
                  </button>
                  <button
                    onClick={() => setViewMode('plain')}
                    className={`px-3 py-1 rounded font-medium transition-colors ${
                      viewMode === 'plain'
                        ? 'bg-[#5865F2] text-white'
                        : 'text-[#949BA4] hover:text-white'
                    }`}
                  >
                    {t.plainText}
                  </button>
                </div>

                <button
                  onClick={handleClear}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-[#DA373C] hover:bg-[#A12828] text-white transition-colors"
                >
                  {t.clearEmail}
                </button>
              </div>
            </div>

            {/* If Gmail Code exists, show quick-copy banner */}
            {authStatus.code && (
              <div className="bg-[#2B2D31] border-l-4 border-l-[#23A55A] p-4 rounded-r-lg flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#23A55A]">
                    {t.gmailDetected}
                  </span>
                  <div className="text-xl font-mono font-bold text-white mt-1">
                    {authStatus.code}
                  </div>
                </div>
                <button
                  onClick={() => handleCopyCode(authStatus.code || '')}
                  className="px-4 py-2 rounded font-medium text-sm text-white bg-[#23A55A] hover:bg-[#1C8B4C] transition-colors"
                >
                  {copied ? t.copied : t.copyCode}
                </button>
              </div>
            )}

            {/* Email Body Container (Discord Embed style) */}
            <div className="bg-[#2B2D31] rounded-lg border-l-4 border-l-[#5865F2] border border-[#383A40] shadow-xl overflow-hidden">
              <div className="px-4 py-3 bg-[#242629] border-b border-[#313338] flex items-center justify-between text-xs text-[#949BA4]">
                <div>
                  <span className="font-semibold text-[#DBDEE1]">{t.from}</span> {authStatus.from ?? 'Discord <noreply@discord.com>'}
                </div>
                <div className="italic">
                  {t.displayNote}
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
              {t.welcomeHeading}
            </h2>
            <p className="text-sm text-[#949BA4] max-w-md mt-2 leading-relaxed">
              {t.welcomeSubtext}
            </p>

            <div className="mt-8 flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#2B2D31] border border-[#383A40] text-xs font-medium text-[#DBDEE1]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#23A55A] animate-ping" />
              <span>{t.waitingPill}</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
