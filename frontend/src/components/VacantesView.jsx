import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Play,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Sparkles,
  TrendingUp,
  Clock,
  Layers,
  X,
  ArrowRight,
  SlidersHorizontal,
  Loader2,
} from 'lucide-react';

function renderHighlightedBullet(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      const isMetric = /\d/.test(inner);
      return (
        <strong
          key={idx}
          className={
            isMetric
              ? 'font-mono font-semibold text-emerald-400'
              : 'font-semibold text-zinc-100'
          }
        >
          {inner}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function getScoreBadgeClasses(score) {
  if (score >= 85) {
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  }
  if (score >= 70) {
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  }
  return 'bg-red-500/15 text-red-400 border-red-500/30';
}

export default function VacantesView({
  jobs,
  keywords,
  searchQuery,
  setSearchQuery,
  onToggleApplied,
  onRunPipeline,
  onOpenSearchConfig,
  onOptimizeJob,
  optimizingJobId,
  optimizeError,
  searchInputRef,
}) {
  const [minScore, setMinScore] = useState(0);
  const [locationFilter, setLocationFilter] = useState('all');
  const [selectedKeyword, setSelectedKeyword] = useState('all');
  const [sortBy, setSortBy] = useState('match');
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id ?? null);
  const [copied, setCopied] = useState(false);
  const detailScrollRef = useRef(null);

  useEffect(() => {
    detailScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedJobId]);

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return jobs
      .filter((job) => {
        if (minScore > 0 && job.matchScore < minScore) return false;
        if (locationFilter === 'tijuana') {
          const loc = (job.location || '').toLowerCase();
          if (!loc.includes('tijuana') && !loc.includes('baja california')) {
            return false;
          }
        } else if (locationFilter === 'mexico_remote') {
          const loc = (job.location || '').toLowerCase();
          if (!loc.includes('remoto') && !loc.includes('remote') && !loc.includes('mexico') && !loc.includes('méxico')) {
            return false;
          }
        }
        if (selectedKeyword !== 'all' && job.keyword !== selectedKeyword) {
          return false;
        }
        if (q) {
          const haystack = [
            job.title,
            job.company,
            job.location,
            job.keyword,
            ...(job.tags || []),
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'match') return b.matchScore - a.matchScore;
        return a.id.localeCompare(b.id);
      });
  }, [jobs, minScore, locationFilter, selectedKeyword, sortBy, searchQuery]);

  const activeJob =
    filteredJobs.find((j) => j.id === selectedJobId) || filteredJobs[0] || null;

  const avgMatch = useMemo(() => {
    if (!jobs.length) return 0;
    const sum = jobs.reduce((acc, j) => acc + j.matchScore, 0);
    return (sum / jobs.length).toFixed(1);
  }, [jobs]);

  const highAffinityCount = useMemo(
    () => jobs.filter((j) => j.matchScore >= 80).length,
    [jobs]
  );

  const handleCopyBullets = async () => {
    if (!activeJob) return;
    const plain = activeJob.bullets
      .map((b) => `• ${b.replace(/\*\*/g, '')}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportHtml = () => {
    const htmlRows = filteredJobs
      .map(
        (j) => `
      <div style="background:#fff;padding:24px;margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="margin:0 0 6px;">${j.title} — ${j.company} (${j.matchScore}% Match ATS)</h2>
        <p style="color:#555;margin:0 0 12px;">${j.location} | ${j.salary || 'Salario no especificado'} | <a href="${j.link}" target="_blank">Ver vacante</a></p>
        <p>${j.summary}</p>
        <h4>Bullets Optimizados:</h4>
        <ul>${j.bullets.map((b) => `<li>${b.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</li>`).join('')}</ul>
      </div>`
      )
      .join('');

    const doc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte JobHunter AI</title></head><body style="font-family:Cambria,serif;max-width:860px;margin:24px auto;background:#f9fafb;padding:16px;"><h1>Resultados de Optimización ATS — JobHunter AI</h1>${htmlRows}</body></html>`;
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resultados_jobhunter_ai.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
              Vacantes & Match
            </h1>
            <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 uppercase">
              • {jobs.length} vacantes analizadas
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Exploración, filtrado y optimización ATS impulsada por Gemini 2.5 Flash
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenSearchConfig}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#111114] text-zinc-200 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 transition cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
            Configurar Búsqueda
          </button>
          <button
            onClick={handleExportHtml}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#111114] text-zinc-200 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            Exportar HTML
          </button>
          <button
            onClick={onRunPipeline}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition shadow-sm shadow-emerald-500/20 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Ejecutar Pipeline
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-500">
            <span>Vacantes Extraídas</span>
            <Layers className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-50">
              {jobs.length}
            </span>
            <span className="text-xs font-mono text-emerald-400">+5 hoy</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1.5">
            Ingesta automática multi-fuente
          </p>
        </div>

        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-500">
            <span>Match Promedio</span>
            <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-50">
              {avgMatch}%
            </span>
            <span className="text-xs font-mono text-emerald-400">
              +4.1% vs anterior
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${Math.min(100, Number(avgMatch))}%` }}
            />
          </div>
        </div>

        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-500">
            <span>Match &gt; 80%</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-50">
              {highAffinityCount}
            </span>
            <span className="text-xs text-zinc-400">posiciones</span>
          </div>
          <span className="inline-block mt-1.5 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Alta afinidad ATS
          </span>
        </div>

        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-500">
            <span>Última Ejecución</span>
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-zinc-50">Hace 18 min</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1.5 font-mono">
            • Playwright + Gemini 2.5 Flash
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[230px]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por puesto, empresa, ubicación o stack (ej: FastAPI, React, Tijuana)..."
            className="w-full bg-[#09090B] border border-zinc-800 rounded-lg pl-9 pr-8 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Score Pills */}
        <div className="flex items-center bg-[#09090B] border border-zinc-800 rounded-lg p-1 text-xs">
          {[
            { label: 'Todas', val: 0 },
            { label: '+70% Match', val: 70 },
            { label: '+85% Match', val: 85 },
          ].map((pill) => (
            <button
              key={pill.val}
              onClick={() => setMinScore(pill.val)}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                minScore === pill.val
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Location Filter */}
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="bg-[#09090B] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50"
        >
          <option value="all">Ubicación: Todas</option>
          <option value="tijuana">Local Tijuana</option>
          <option value="mexico_remote">México Remoto</option>
        </select>

        {/* Keyword Dropdown */}
        <select
          value={selectedKeyword}
          onChange={(e) => setSelectedKeyword(e.target.value)}
          className="bg-[#09090B] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50"
        >
          <option value="all">Todas las keywords ({keywords.length})</option>
          {keywords.map((kw) => (
            <option key={kw} value={kw}>
              {kw}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-[#09090B] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50"
        >
          <option value="match">Ordenar: Mayor Match</option>
          <option value="recent">Ordenar: Más recientes</option>
        </select>
      </div>

      {/* Master-Detail Grid (Independent Scroll Panes on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[calc(100vh-310px)] lg:min-h-[480px]">
        {/* Left List (40% -> 5 cols) */}
        <div className="lg:col-span-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-1 pb-2 text-[11px] font-mono text-zinc-500 uppercase shrink-0">
            <span>
              Mostrando {filteredJobs.length} de {jobs.length} resultados
            </span>
            {minScore > 0 && (
              <span className="text-emerald-400">Filtro: &gt;{minScore}% activo</span>
            )}
          </div>

          <div className="space-y-2.5 lg:flex-1 lg:overflow-y-auto lg:pr-1.5">

          {filteredJobs.length === 0 ? (
            <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-8 text-center">
              <p className="text-sm text-zinc-300 font-medium">
                No hay vacantes con esos filtros
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Prueba bajar el puntaje mínimo o limpiar el texto de búsqueda.
              </p>
            </div>
          ) : (
            filteredJobs.map((job) => {
              const isSelected = activeJob?.id === job.id;
              return (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={`w-full text-left rounded-xl p-4 transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#131817] border-emerald-500/50 shadow-[0_0_24px_rgba(16,185,129,0.06)]'
                      : 'bg-[#111114] border-zinc-800/80 hover:border-zinc-700/90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-zinc-100 truncate">
                        {job.title}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5 truncate">
                        {job.company} · {job.location}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getScoreBadgeClasses(
                        job.matchScore
                      )}`}
                    >
                      • {job.matchScore}%
                    </span>
                  </div>

                  {/* Stack Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {job.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                          isSelected && tag.toLowerCase().includes('gemini')
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-800/60 text-[11px]">
                    <span className="text-zinc-500 font-mono">
                      {job.postedAt} · Scraped vía {job.source}
                    </span>
                    {job.applied ? (
                      <span className="text-emerald-400 font-medium inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Postulado
                      </span>
                    ) : isSelected ? (
                      <span className="text-emerald-400 font-medium inline-flex items-center gap-1">
                        Revisar <ArrowRight className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="text-zinc-500">Sin postular</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
          </div>
        </div>

        {/* Right Detail Panel (60% -> 7 cols) */}
        <div
          ref={detailScrollRef}
          className="lg:col-span-7 space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1.5"
        >
          {activeJob ? (
            <>
              {/* Header Card */}
              <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono text-sm font-bold text-zinc-200 shrink-0">
                      {activeJob.initials}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-zinc-50 leading-snug">
                        {activeJob.title}
                      </h2>
                      <p className="text-xs text-zinc-400 mt-1">
                        <span className="text-zinc-200 font-medium">
                          {activeJob.company}
                        </span>{' '}
                        · {activeJob.location}
                        {activeJob.salary && (
                          <span className="text-emerald-400 font-mono ml-2">
                            · {activeJob.salary}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Big ATS Match Score */}
                  <div
                    className={`px-4 py-2.5 rounded-xl border text-center min-w-[96px] ${getScoreBadgeClasses(
                      activeJob.matchScore
                    )}`}
                  >
                    <div className="font-mono text-2xl font-bold leading-none">
                      {activeJob.matchScore}%
                    </div>
                    <div className="font-mono text-[10px] tracking-wider uppercase mt-1 opacity-80">
                      Match ATS
                    </div>
                  </div>
                </div>

                {/* Action Row */}
                <div className="mt-4 pt-4 border-t border-zinc-800/70 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-emerald-400 inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Excelente compatibilidad con tu perfil verificado
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={activeJob.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-zinc-200 border border-zinc-700/80 hover:bg-zinc-800 transition"
                    >
                      Ver en {activeJob.source}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() =>
                        onToggleApplied(activeJob.id, !activeJob.applied)
                      }
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        activeJob.applied
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-zinc-100 text-zinc-950 hover:bg-white'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {activeJob.applied
                        ? 'Marcado como Postulado'
                        : 'Marcar como Postulado'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Gemini Summary */}
              <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-2">
                  <Sparkles className="w-4 h-4" />
                  Resumen y Recomendación Gemini 2.5 Flash
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {activeJob.summary}
                </p>
              </div>

              {/* ATS Gaps */}
              <div className="bg-[#161113] border border-red-900/40 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    Palabras Clave Faltantes / Brechas ATS
                  </div>
                  <span className="font-mono text-[11px] text-red-400/90">
                    {activeJob.gaps.length} brechas críticas
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mb-3">
                  Detectadas {activeJob.gaps.length} palabras clave no encontradas
                  explícitamente en tu CV actual indexado:
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {activeJob.gaps.map((gap) => (
                    <span
                      key={gap}
                      className="inline-flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-md bg-red-500/10 text-red-300 border border-red-500/25"
                    >
                      <X className="w-3 h-3 text-red-400" />
                      {gap}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 italic">
                  Sugerencia: {activeJob.gapSuggestion}
                </p>
              </div>

              {/* Optimized Bullets */}
              <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-5">
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Bullets Optimizados para tu CV
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={optimizingJobId === activeJob.id}
                      onClick={() => onOptimizeJob?.(activeJob.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 disabled:opacity-50 transition cursor-pointer"
                    >
                      {optimizingJobId === activeJob.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Optimizando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          {activeJob.bullets?.length > 0 && activeJob.optimized !== false
                            ? 'Regenerar Bullets'
                            : 'Optimizar Bullets con IA'}
                        </>
                      )}
                    </button>
                    {activeJob.bullets?.length > 0 && (
                      <button
                        onClick={handleCopyBullets}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-zinc-200 border border-zinc-700/80 hover:bg-zinc-800 transition cursor-pointer"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-zinc-400" />
                            Copiar Bullets
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {optimizeError && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                    {optimizeError}
                  </div>
                )}

                {activeJob.bullets?.length > 0 ? (
                  <div className="space-y-2.5">
                    {activeJob.bullets.map((bullet, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg bg-[#0B0B0E] border border-zinc-800/80 text-sm text-zinc-300 leading-relaxed flex gap-2.5"
                      >
                        <span className="text-emerald-400 font-bold mt-0.5">•</span>
                        <p>{renderHighlightedBullet(bullet)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-5 rounded-lg bg-[#0B0B0E] border border-dashed border-zinc-800 text-center">
                    <p className="text-xs text-zinc-400">
                      Esta vacante fue analizada en modo <span className="font-mono text-zinc-200">Solo Análisis ATS</span>.
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Haz clic en <span className="text-emerald-400 font-medium">Optimizar Bullets con IA</span> si deseas adaptar tu CV específicamente para esta oferta.
                    </p>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span>Formato compatible con Greenhouse, Lever y Workday</span>
                  <span className="text-emerald-400">
                    {activeJob.analyzedBy || 'Listo para exportar'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-10 text-center text-zinc-500 text-sm">
              Selecciona una vacante para ver su análisis ATS detallado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
