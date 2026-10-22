import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa-install-dismissed') === '1');

  useEffect(() => {
    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleInstallAvailable);
    window.addEventListener('appinstalled', () => setInstallEvent(null));
    return () => window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
  }, []);

  if (!installEvent || dismissed) return null;

  async function install() {
    await installEvent?.prompt();
    const choice = await installEvent?.userChoice;
    if (choice?.outcome === 'accepted') setInstallEvent(null);
  }

  function dismiss() {
    localStorage.setItem('pwa-install-dismissed', '1');
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-blue-200 bg-white p-3 shadow-xl">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
        <Download className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">Install Pathology LIS</p>
        <p className="text-xs text-slate-500">Use the app from your mobile home screen.</p>
      </div>
      <button type="button" onClick={install} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
        Install
      </button>
      <button type="button" onClick={dismiss} aria-label="Dismiss install prompt" className="rounded p-1 text-slate-400 hover:bg-slate-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
