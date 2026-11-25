import { useEffect, useRef, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import Sidebar from './components/Sidebar';
import VacantesView from './components/VacantesView';
import SearchConfigView from './components/SearchConfigView';
import PipelineView from './components/PipelineView';
import ProfileCvView from './components/ProfileCvView';
import AutomationsView from './components/AutomationsView';
import {
  INITIAL_CONFIG,
  INITIAL_CV,
  INITIAL_JOBS,
  INITIAL_PROMPT,
} from './data/mockJobs';

function buildConfigPayload(config) {
  return {
    keywords: config.keywords,
    location: config.location,
    time_filter: config.time_filter,
    max_per_keyword: Number(config.max_per_keyword) || 15,
    headless: Boolean(config.headless),
    exclude_english: Boolean(config.exclude_english ?? true),
    work_mode: config.work_mode || 'both',
    sources: config.sources?.length
      ? config.sources
      : ['linkedin', 'computrabajo', 'getonboard'],
    ai_provider: config.ai_provider || 'gemini',
    ai_model: config.ai_model || 'gemini-2.5-flash',
    batch_size: Number(config.batch_size) || 4,
    min_match_score: Number(config.min_match_score) || 75,
    alert_min_score: Number(config.alert_min_score) || 85,
    schedule_enabled: Boolean(config.schedule_enabled),
    schedule_interval_hours: Number(config.schedule_interval_hours) || 12,
    temperature: Number(config.temperature) || 0.2,
    api_keys: config.api_keys || {},
    alert_secrets: config.alert_secrets || {},
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('vacantes');
  const [apiConnected, setApiConnected] = useState(false);
  const [jobs, setJobs] = useState(INITIAL_JOBS);
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [cvText, setCvText] = useState(INITIAL_CV);
  const [prompt, setPrompt] = useState(INITIAL_PROMPT);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState('idle');
  const [activePhase, setActivePhase] = useState('ready');
  const [includePhase1, setIncludePhase1] = useState(true);
  const [optimizeBullets, setOptimizeBullets] = useState(false);
  const [optimizingJobId, setOptimizingJobId] = useState(null);
  const [optimizeError, setOptimizeError] = useState('');
  const [generatingOutreachJobId, setGeneratingOutreachJobId] = useState(null);
  const [outreachError, setOutreachError] = useState('');
  const [logs, setLogs] = useState([
    '[INFO] JobHunter AI Console inicializada.',
    '[INFO] Playwright + SQLite + Gemini/DeepSeek listos para analizar vacantes.',
  ]);
  const searchInputRef = useRef(null);

  // Detectar si FastAPI backend está corriendo
  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.status === 'ok') {
          setApiConnected(true);
          fetch('/api/config')
            .then((r) => (r.ok ? r.json() : null))
            .then((cfg) => {
              if (cfg?.keywords) setConfig((prev) => ({ ...prev, ...cfg }));
            })
            .catch(() => {});
          fetch('/api/cv')
            .then((r) => (r.ok ? r.json() : null))
            .then((cv) => {
              if (cv?.content) setCvText(cv.content);
            })
            .catch(() => {});
          fetch('/api/jobs')
            .then((r) => (r.ok ? r.json() : null))
            .then((list) => {
              if (Array.isArray(list) && list.length > 0) setJobs(list);
            })
            .catch(() => {});
        }
      })
      .catch(() => setApiConnected(false));
  }, []);

  // Atajo Ctrl+K / Cmd+K para enfocar buscador de vacantes
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveTab('vacantes');
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const flashSaved = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleSaveConfig = async () => {
    if (apiConnected) {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildConfigPayload(config)),
      }).catch(() => {});
      await fetch('/api/prompt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: prompt }),
      }).catch(() => {});
      // Refrescar estado de alertas (.env) y lista de vacantes filtradas
      const cfgRes = await fetch('/api/config').catch(() => null);
      if (cfgRes?.ok) {
        const freshCfg = await cfgRes.json();
        if (freshCfg?.keywords) {
          setConfig((prev) => ({
            ...prev,
            ...freshCfg,
            alert_secrets: { discord_webhook: '', telegram_token: '', telegram_chat_id: '' },
          }));
        }
      }
      const jobsRes = await fetch('/api/jobs').catch(() => null);
      if (jobsRes?.ok) {
        const list = await jobsRes.json();
        if (Array.isArray(list)) setJobs(list);
      }
    }
    flashSaved();
  };

  const handleSaveCv = async () => {
    if (apiConnected) {
      await fetch('/api/cv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: cvText }),
      }).catch(() => {});
    }
    flashSaved();
  };

  const handleUploadCvPdf = async (file) => {
    if (!apiConnected) {
      return {
        ok: false,
        error: 'Conecta el backend FastAPI (:8000) para extraer texto de archivos PDF.',
      };
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/cv/upload-pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.detail || 'Error al procesar el PDF.' };
      }
      if (data.content) {
        setCvText(data.content);
      }
      flashSaved();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Error de red subiendo el PDF al backend.' };
    }
  };

  const handleUpdateJobCrm = async (jobId, patch) => {
    setJobs((prev) =>
      prev.map((j) => {
        if (j.id !== jobId) return j;
        const nextStatus =
          patch.status !== undefined
            ? patch.status
            : patch.applied !== undefined
            ? patch.applied
              ? 'applied'
              : 'pending'
            : j.status || (j.applied ? 'applied' : 'pending');
        const nextApplied =
          patch.applied !== undefined
            ? patch.applied
            : nextStatus === 'applied' || nextStatus === 'interview';
        return {
          ...j,
          status: nextStatus,
          applied: nextApplied,
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        };
      })
    );
    if (apiConnected) {
      await fetch(`/api/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).catch(() => {});
    }
  };

  const handleToggleApplied = async (jobId, applied) => {
    return handleUpdateJobCrm(jobId, {
      applied,
      status: applied ? 'applied' : 'pending',
    });
  };

  // Polling en vivo de logs del backend FastAPI cuando el pipeline corre
  useEffect(() => {
    if (!apiConnected || pipelineStatus !== 'running') return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/pipeline/status');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.logs) && data.logs.length > 0) {
          setLogs(data.logs);
        }
        if (data.status !== 'running') {
          setPipelineStatus(data.status || 'idle');
          setActivePhase('ready');
          const jobsRes = await fetch('/api/jobs');
          if (jobsRes.ok) {
            const list = await jobsRes.json();
            if (Array.isArray(list) && list.length > 0) {
              setJobs(list);
            }
          }
        }
      } catch {
        // Ignorar errores transitorios de polling
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [apiConnected, pipelineStatus]);

  const handleTriggerPhase = async (phase) => {
    setActiveTab('pipeline');
    setPipelineStatus('running');
    setActivePhase(phase);
    const now = new Date().toLocaleTimeString();

    if (apiConnected) {
      setLogs([
        `[${now}] Guardando parámetros de búsqueda en config.json...`,
        `[${now}] Iniciando fase '${phase}' en backend FastAPI...`,
      ]);
      try {
        await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildConfigPayload(config)),
        });
        const params = new URLSearchParams({
          phase,
          optimize_bullets: String(optimizeBullets),
          include_phase1: String(includePhase1),
        });
        const res = await fetch(`/api/pipeline/run?${params.toString()}`, {
          method: 'POST',
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setLogs((prev) => [
            ...prev,
            `[ERROR] ${err.detail || 'No se pudo iniciar la fase.'}`,
          ]);
          setPipelineStatus('idle');
        }
      } catch {
        setLogs((prev) => [...prev, `[ERROR] No se pudo conectar con FastAPI (:8000).`]);
        setPipelineStatus('idle');
      }
    } else {
      setLogs((prev) => [
        ...prev,
        `[${now}] Iniciando fase '${phase}' con ${config.keywords.length} keywords en "${config.location}"...`,
        `[${now}] Playwright: buscando vacantes recientes (${config.time_filter}, límite ${config.max_per_keyword}/keyword)...`,
      ]);
      setTimeout(() => {
        setLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ${config.ai_provider === 'deepseek' ? 'DeepSeek' : 'Gemini'} (${config.ai_model}): evaluando compatibilidad ATS contra profile/cv.md...`,
          `[${new Date().toLocaleTimeString()}] [OK] FASE '${phase}' COMPLETADA. ${jobs.length} vacantes disponibles en Vacantes & Match.`,
        ]);
        setPipelineStatus('idle');
        setActivePhase('ready');
      }, 1500);
    }
  };

  const handleOptimizeJob = async (jobId) => {
    setOptimizingJobId(jobId);
    setOptimizeError('');
    try {
      if (apiConnected) {
        await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildConfigPayload(config)),
        });
        const res = await fetch(`/api/jobs/${jobId}/optimize`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          setOptimizeError(data.detail || 'No se pudieron optimizar los bullets.');
          return;
        }
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, bullets: data.bullets || [], optimized: true } : j
          )
        );
      } else {
        setOptimizeError('Conecta el backend FastAPI (:8000) para optimizar bullets con IA.');
      }
    } catch {
      setOptimizeError('Error de conexión con FastAPI al optimizar bullets.');
    } finally {
      setOptimizingJobId(null);
    }
  };

  const handleGenerateOutreach = async (jobId) => {
    setGeneratingOutreachJobId(jobId);
    setOutreachError('');
    try {
      if (apiConnected) {
        await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildConfigPayload(config)),
        });
        const res = await fetch(`/api/jobs/${jobId}/outreach`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          setOutreachError(data.detail || 'No se pudo generar el mensaje para el reclutador.');
          return;
        }
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, outreachMessage: data.message || '' } : j
          )
        );
      } else {
        setOutreachError('Conecta el backend FastAPI (:8000) para generar el mensaje con IA.');
      }
    } catch {
      setOutreachError('Error de conexión con FastAPI al generar mensaje de contacto.');
    } finally {
      setGeneratingOutreachJobId(null);
    }
  };

  const appliedCount = jobs.filter((j) => {
    const st = j.status || (j.applied ? 'applied' : 'pending');
    return st === 'applied' || st === 'interview';
  }).length;

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] flex">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        apiConnected={apiConnected}
        appliedCount={appliedCount}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Console Bar */}
        <header className="h-14 border-b border-zinc-800/70 bg-[#09090B]/90 backdrop-blur sticky top-0 z-20 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium text-zinc-300">JobHunter Console</span>
            <span className="text-zinc-600">/</span>
            <span className="font-mono text-zinc-500">
              {activeTab === 'vacantes'
                ? 'vacantes-match'
                : activeTab === 'postulaciones'
                ? 'mis-postulaciones'
                : activeTab === 'automatizaciones'
                ? 'automatizaciones-alertas'
                : activeTab === 'config'
                ? 'busqueda-config'
                : activeTab === 'pipeline'
                ? 'pipeline-runner'
                : 'perfil-cv'}
            </span>
          </div>

          <button
            onClick={() => {
              setActiveTab('vacantes');
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#111114] border border-zinc-800 text-xs text-zinc-400 hover:border-zinc-700 transition cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <span>Filtrar vacantes...</span>
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700/80 text-zinc-400">
              Ctrl K
            </kbd>
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">
          {(activeTab === 'vacantes' || activeTab === 'postulaciones') && (
            <VacantesView
              mode={activeTab}
              jobs={jobs}
              keywords={config.keywords}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onToggleApplied={handleToggleApplied}
              onUpdateJobCrm={handleUpdateJobCrm}
              onRunPipeline={() => handleTriggerPhase('all')}
              onOpenSearchConfig={() => setActiveTab('config')}
              onGoToVacantes={() => setActiveTab('vacantes')}
              onGoToPostulaciones={() => setActiveTab('postulaciones')}
              onOptimizeJob={handleOptimizeJob}
              optimizingJobId={optimizingJobId}
              optimizeError={optimizeError}
              onGenerateOutreach={handleGenerateOutreach}
              generatingOutreachJobId={generatingOutreachJobId}
              outreachError={outreachError}
              apiConnected={apiConnected}
              searchInputRef={searchInputRef}
            />
          )}

          {activeTab === 'automatizaciones' && (
            <AutomationsView
              config={config}
              setConfig={setConfig}
              onSaveConfig={handleSaveConfig}
              savedNotice={savedNotice}
              apiConnected={apiConnected}
            />
          )}

          {activeTab === 'config' && (
            <SearchConfigView
              config={config}
              setConfig={setConfig}
              prompt={prompt}
              setPrompt={setPrompt}
              onSaveConfig={handleSaveConfig}
              onRunSearch={() => handleTriggerPhase('scrape')}
              savedNotice={savedNotice}
              apiConnected={apiConnected}
            />
          )}

          {activeTab === 'pipeline' && (
            <PipelineView
              pipelineStatus={pipelineStatus}
              activePhase={activePhase}
              logs={logs}
              includePhase1={includePhase1}
              setIncludePhase1={setIncludePhase1}
              optimizeBullets={optimizeBullets}
              setOptimizeBullets={setOptimizeBullets}
              onTriggerPhase={handleTriggerPhase}
              onClearLogs={() => setLogs(['[INFO] Logs limpiados.'])}
            />
          )}

          {activeTab === 'perfil' && (
            <ProfileCvView
              cvText={cvText}
              setCvText={setCvText}
              onSaveCv={handleSaveCv}
              onUploadPdf={handleUploadCvPdf}
              savedNotice={savedNotice}
            />
          )}
        </main>
      </div>
    </div>
  );
}
