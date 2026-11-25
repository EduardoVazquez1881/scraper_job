import {
  Briefcase,
  Play,
  FileText,
  SlidersHorizontal,
  Sparkles,
  Bell,
  Send,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'vacantes', label: 'Vacantes & Match', icon: Briefcase },
  { id: 'postulaciones', label: 'Postulaciones', icon: Send },
  { id: 'pipeline', label: 'Ejecutar Pipeline', icon: Play },
  { id: 'automatizaciones', label: 'Automatizaciones', icon: Bell },
  { id: 'perfil', label: 'Mi Perfil & CV', icon: FileText },
  { id: 'config', label: 'Búsqueda & Config', icon: SlidersHorizontal },
];

export default function Sidebar({
  activeTab,
  onSelectTab,
  apiConnected,
  appliedCount = 0,
}) {
  return (
    <aside className="w-[240px] shrink-0 bg-[#0B0B0E] border-r border-zinc-800/80 flex flex-col justify-between h-screen sticky top-0 select-none">
      <div>
        {/* Brand */}
        <div className="px-4 py-4 flex items-center gap-2.5 border-b border-zinc-800/70">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[15px] tracking-tight text-zinc-100">
              JobHunter AI
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/90 text-zinc-400 border border-zinc-700/60">
              v2.5
            </span>
          </div>
        </div>

        {/* API Status Pill */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#111114] border border-zinc-800/80 text-xs">
            <span className="flex items-center gap-2 text-zinc-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  apiConnected
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                    : 'bg-amber-400'
                }`}
              />
              {apiConnected ? 'API Conectada' : 'Modo Beta Local'}
            </span>
            <span className="font-mono text-[11px] text-zinc-500">:8000</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-2.5 py-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-zinc-800/90 text-zinc-100 border border-zinc-700/70 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-emerald-400' : 'text-zinc-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {item.id === 'postulaciones' && appliedCount > 0 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    {appliedCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
