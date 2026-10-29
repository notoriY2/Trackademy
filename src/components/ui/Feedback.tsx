import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; type: ToastType };
type ConfirmOpts = { title: string; message?: string; confirmText?: string; danger?: boolean };

const Ctx = createContext<{
  toast: (m: string, t?: ToastType) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
}>({ toast: () => {}, confirm: async () => false });

export const useFeedback = () => useContext(Ctx);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const confirm = useCallback(
    (o: ConfirmOpts) => new Promise<boolean>(resolve => setDlg({ ...o, resolve })),
    []
  );

  const close = (v: boolean) => { dlg?.resolve(v); setDlg(null); };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      <div className="fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 pointer-events-none
                      sm:inset-x-auto sm:right-4 sm:items-end" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white shadow-lg
              ${t.type === 'success' ? 'bg-emerald-600' : t.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
            {t.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0" /> : t.type === 'error' ? <XCircle className="h-5 w-5 shrink-0" /> : <Info className="h-5 w-5 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button aria-label="Dismiss" onClick={() => setToasts(x => x.filter(y => y.id !== t.id))}><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>

      {dlg && (
        <Modal open onClose={() => close(false)} title={dlg.title} size="sm"
          footer={
            <>
              <button onClick={() => close(false)} className="rounded-xl border px-4 py-2.5 text-gray-700">Cancel</button>
              <button onClick={() => close(true)}
                className={`rounded-xl px-4 py-2.5 font-medium text-white ${dlg.danger ? 'bg-red-600' : 'bg-blue-600'}`}>
                {dlg.confirmText ?? 'Confirm'}
              </button>
            </>
          }>
          {dlg.message && <p className="text-gray-600">{dlg.message}</p>}
        </Modal>
      )}
    </Ctx.Provider>
  );
};

/* Accessible modal: Esc closes, focus is trapped, ARIA labelled.
   Bottom sheet on phones, centred dialog on desktop. */
export const Modal: React.FC<{
  open: boolean; onClose: () => void; title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl'; footer?: React.ReactNode; children: React.ReactNode;
}> = ({ open, onClose, title, size = 'md', footer, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useRef(`m-${Math.random().toString(36).slice(2)}`).current;
  const maxW = { sm: 'sm:max-w-md', md: 'sm:max-w-2xl', lg: 'sm:max-w-4xl', xl: 'sm:max-w-6xl' }[size];

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const sel = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
    ref.current?.querySelector<HTMLElement>(sel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && ref.current) {
        const els = Array.from(ref.current.querySelectorAll<HTMLElement>(sel));
        if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus(); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
        onMouseDown={e => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-2xl ${maxW}`}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t bg-gray-50 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
};

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) =>
  <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;

export const EmptyState: React.FC<{ title: string; hint?: string; icon?: React.ReactNode; action?: React.ReactNode }> =
  ({ title, hint, icon, action }) => (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 text-gray-300">{icon}</div>
      <p className="font-medium text-gray-900">{title}</p>
      {hint && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );