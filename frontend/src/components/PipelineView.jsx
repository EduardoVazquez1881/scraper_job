import { Play, CheckCircle2, Loader2, Terminal, Trash2 } from 'lucide-react';

const PHASES = [
  {
    id: 'scrape',
    num: '01',
    title: 'Scraping Multi-Fuente',
    subtitle: 'LinkedIn · Computrabajo · Indeed · Get on Board',
  },
  {
    id: 'optimize',
    num: '02',
    title: 'Análisis ATS (IA)',
    subtitle: 'Gemini / DeepSeek · Match Score y Brechas',
  },
  {
    id: 'html',
    num: '03',
    title: 'Generación de Reporte HTML',
    subtitle: 'Exportación y formato Word',
  },
];

export default function PipelineView({
  pipelineStatus,
  activePhase,
  logs,
  includePhase1,
  setIncludePhase1,
  optimizeBullets,
  setOptimizeBullets,
  onTriggerPhase,
  onClearLogs,
}) {
  const isRunning = pipelineStatus === 'running';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] text-emerald-400 uppercase tracking-wider">
            AUTOMATION ORCHESTRATOR
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 mt-0.5">
            Ejecutar Pipeline
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Por defecto la Fase 02 realiza solo análisis ATS (Match + Brechas). Activa la optimización de bullets si deseas reescribir tu CV en lote.
          </p>
        </div>

        <button
          disabled={isRunning}
          onClick={() => onTriggerPhase('all')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 transition cursor-pointer"
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          {isRunning
            ? 'Ejecutando Pipeline...'
            : optimizeBullets
            ? 'Ejecutar Fase 01 + Análisis y Optimización'
            : 'Ejecutar Fase 01 + Solo Análisis ATS'}
        </button>
      </div>

      {/* Mode Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-zinc-100">
              Incluir Fase 01 (Scraping) al correr Fase 02
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Si está activo, extrae vacantes nuevas antes de analizarlas con IA.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIncludePhase1(!includePhase1)}
            className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 cursor-pointer ${
              includePhase1 ? 'bg-emerald-500' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                includePhase1 ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-zinc-100">
              Activar optimización de bullets en Fase 02
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Apagado = solo Match Score y brechas (ahorra tokens; puedes optimizar cada vacante manualmente).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOptimizeBullets(!optimizeBullets)}
            className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 cursor-pointer ${
              optimizeBullets ? 'bg-emerald-500' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                optimizeBullets ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 3-phase horizontal stepper */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PHASES.map((phase) => {
          const runningThis =
            isRunning && (activePhase === phase.id || activePhase === 'all');
          return (
            <div
              key={phase.id}
              className={`bg-[#111114] border rounded-xl p-4 flex flex-col justify-between gap-3 ${
                runningThis ? 'border-emerald-500/50' : 'border-zinc-800/80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-emerald-400 font-semibold">
                    FASE {phase.num}
                  </span>
                  {runningThis ? (
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-zinc-600" />
                  )}
                </div>
                <h3 className="text-sm font-semibold text-zinc-100 mt-2">
                  {phase.title}
                </h3>
                <p className="text-xs font-mono text-zinc-500 mt-0.5">
                  {phase.subtitle}
                </p>
              </div>
              <button
                disabled={isRunning}
                onClick={() => onTriggerPhase(phase.id)}
                className="w-full py-2 rounded-lg text-xs font-medium bg-[#09090B] border border-zinc-800 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-50 transition cursor-pointer"
              >
                {phase.id === 'optimize'
                  ? includePhase1
                    ? 'Ejecutar Fase 01 + Fase 02'
                    : optimizeBullets
                    ? 'Ejecutar Análisis + Optimización'
                    : 'Ejecutar Solo Análisis ATS'
                  : 'Ejecutar solo esta fase'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Live Terminal Console */}
      <div className="bg-[#0B0B0E] border border-zinc-800/80 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-[#111114] border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            Consola de Logs en Vivo
          </div>
          <button
            onClick={onClearLogs}
            className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-200 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            Limpiar
          </button>
        </div>
        <div className="p-4 font-mono text-xs space-y-1.5 min-h-[260px] max-h-[380px] overflow-y-auto text-zinc-300">
          {logs.map((line, idx) => (
            <div
              key={idx}
              className={
                line.includes('[ERROR]')
                  ? 'text-red-400'
                  : line.includes('[WARN]') || line.includes('[SKIP]')
                  ? 'text-amber-400'
                  : line.includes('[OK]') || line.includes('COMPLETADA')
                  ? 'text-emerald-400'
                  : 'text-zinc-300'
              }
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
