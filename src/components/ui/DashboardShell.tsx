import React, { useState } from 'react';
import { GraduationCap, LogOut, Menu, User, X } from 'lucide-react';

export interface ShellTab { id: string; name: string; icon: React.ComponentType<{ className?: string }>; badge?: boolean }

interface Props {
  portalLabel: string; portalColor: string;           // e.g. "Student Portal", "bg-blue-100 text-blue-800"
  tabs: ShellTab[]; active: string; onChange: (id: string) => void;
  userName: string; userNumber: string;
  onProfile: () => void; onLogout: () => void;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}

const DashboardShell: React.FC<Props> = ({ portalLabel, portalColor, tabs, active, onChange, userName, userNumber, onProfile, onLogout, headerExtra, children }) => {
  const [drawer, setDrawer] = useState(false);
  const pick = (id: string) => { onChange(id); setDrawer(false); window.scrollTo({ top: 0 }); };
  const primary = tabs.slice(0, 4);
  const overflow = tabs.slice(4);

  const NavButton = ({ t }: { t: ShellTab }) => {
    const Icon = t.icon;
    return (
      <button onClick={() => pick(t.id)}
        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] transition-colors
          ${active === t.id ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}>
        <Icon className="h-5 w-5" />{t.name}
        {t.badge && <span className="ml-auto h-2 w-2 rounded-full bg-red-500" />}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center justify-between px-3 sm:h-16 sm:px-6">
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 lg:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}><Menu className="h-6 w-6 text-gray-700" /></button>
            <GraduationCap className="h-7 w-7 text-blue-600" />
            <span className="text-lg font-bold text-gray-900 sm:text-2xl">Trackademy</span>
            <span className={`ml-2 hidden rounded-full px-2 py-1 text-xs font-medium sm:inline ${portalColor}`}>{portalLabel}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            {headerExtra}
            <button onClick={onProfile} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-gray-100">
              <User className="h-5 w-5 text-gray-500" />
              <span className="hidden text-sm text-gray-700 sm:inline">{userName}</span>
              <span className="hidden text-xs text-gray-500 md:inline">({userNumber})</span>
            </button>
            <button onClick={onLogout} aria-label="Logout" className="flex items-center gap-1 rounded-xl px-2 py-2 text-gray-600 hover:text-red-600">
              <LogOut className="h-5 w-5" /><span className="hidden text-sm sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="lg:flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white lg:block">
          <nav className="sticky top-16 space-y-1 p-3">{tabs.map(t => <NavButton key={t.id} t={t} />)}</nav>
        </aside>

        {/* Content: normal page scroll (no nested h-[calc(100vh-64px)] scroller) */}
        <main className="min-w-0 flex-1 p-4 pb-28 sm:p-6 lg:p-8 lg:pb-8">{children}</main>
      </div>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside role="dialog" aria-label="Menu" onClick={e => e.stopPropagation()}
            className="absolute inset-y-0 left-0 w-72 max-w-[85%] overflow-y-auto bg-white p-3 shadow-xl pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="mb-2 flex items-center justify-between px-2 py-2">
              <span className="font-bold text-gray-900">Menu</span>
              <button onClick={() => setDrawer(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            <nav className="space-y-1">{tabs.map(t => <NavButton key={t.id} t={t} />)}</nav>
          </aside>
        </div>
      )}

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${primary.length + (overflow.length ? 1 : 0)}, minmax(0,1fr))` }}>
          {primary.map(t => {
            const Icon = t.icon; const on = active === t.id;
            return (
              <button key={t.id} onClick={() => pick(t.id)} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${on ? 'text-blue-600' : 'text-gray-500'}`}>
                <Icon className="h-5 w-5" /><span className="truncate max-w-[4.5rem]">{t.name.split(' ')[0]}</span>
              </button>
            );
          })}
          {overflow.length > 0 && (
            <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] text-gray-500">
              <Menu className="h-5 w-5" /><span>More</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
};

export default DashboardShell;