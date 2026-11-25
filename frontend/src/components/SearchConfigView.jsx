import { useState } from 'react';
import {
  Save,
  Search,
  MapPin,
  Cpu,
  Terminal,
  Plus,
  X,
  CheckCircle2,
  Play,
  RotateCcw,
  KeyRound,
  Eye,
  EyeOff,
  Zap,
  Loader2,
  AlertCircle,
} from 'lucide-react';

const PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    envName: 'GEMINI_API_KEY',
    placeholder: 'AIzaSy...',
    sdkLabel: 'Google Generative AI',
    models: [
      {
        id: 'gemini-2.5-flash',
        badge: 'Recomendado · Alta velocidad',
        desc: 'Ideal para evaluar lotes de vacantes con bajo costo.',
      },
      {
        id: 'gemini-2.5-pro',
        badge: 'Razonamiento complejo',
        desc: 'Mayor profundidad en análisis de brechas técnicas.',
      },
    ],
  },
  deepseek: {
    name: 'DeepSeek',
    envName: 'DEEPSEEK_API_KEY',
    placeholder: 'sk-...',
    sdkLabel: 'DeepSeek OpenAI-Compatible API',
    models: [
      {
        id: 'deepseek-chat',
        badge: 'DeepSeek V3 · Rápido y económico',
        desc: 'Excelente relación calidad/precio para scoring ATS.',
      },
      {
        id: 'deepseek-reasoner',
        badge: 'DeepSeek R1 · Razonamiento',
        desc: 'Análisis profundo paso a paso para roles complejos.',
      },
    ],
  },
};

const SOURCE_OPTIONS = [
  { id: 'linkedin', label: 'LinkedIn', hint: 'Playwright' },
  { id: 'computrabajo', label: 'Computrabajo MX', hint: 'Español / MX' },
  { id: 'indeed', label: 'Indeed MX', hint: 'Playwright' },
  { id: 'getonboard', label: 'Get on Board', hint: 'API Oficial' },
];

export default function SearchConfigView({
  config,
  setConfig,
  prompt,
  setPrompt,
  onSaveConfig,
  onRunSearch,
  savedNotice,
  apiConnected,
}) {
  const [newKeyword, setNewKeyword] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const activeProviderKey = config.ai_provider === 'deepseek' ? 'deepseek' : 'gemini';
  const providerInfo = PROVIDERS[activeProviderKey];
  const currentApiKey = config.api_keys?.[activeProviderKey] ?? '';

  const handleSelectProvider = (providerId) => {
    const defaultModel = PROVIDERS[providerId].models[0].id;
    setConfig({
      ...config,
      ai_provider: providerId,
      ai_model: defaultModel,
    });
    setTestResult(null);
  };

  const handleApiKeyChange = (value) => {
    setConfig({
      ...config,
      api_keys: {
        ...(config.api_keys || {}),
        [activeProviderKey]: value,
      },
    });
    if (testResult) setTestResult(null);
  };

  const handleTestConnection = async () => {
    const trimmedKey = currentApiKey.trim();
    if (!trimmedKey && !apiConnected) {
      setTestResult({
        ok: false,
        message: `Ingresa tu ${providerInfo.envName} para validar la conexión.`,
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      if (apiConnected) {
        const res = await fetch('/api/ai/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: activeProviderKey,
            model: config.ai_model,
            api_key: trimmedKey,
          }),
        });
        const data = await res.json();
        setTestResult({
          ok: Boolean(data.ok),
          message: data.message || (data.ok ? 'Conexión válida.' : 'Error de validación.'),
        });
      } else {
        // Validación directa desde navegador cuando el backend FastAPI aún no está levantado
        const t0 = performance.now();
        let res;
        if (activeProviderKey === 'gemini') {
          res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
              trimmedKey
            )}`
          );
        } else {
          res = await fetch('https://api.deepseek.com/models', {
            headers: { Authorization: `Bearer ${trimmedKey}` },
          });
        }
        const latency = Math.round(performance.now() - t0);
        if (res.ok) {
          setTestResult({
            ok: true,
            message: `Conexión exitosa con ${providerInfo.name} (${latency} ms).`,
          });
        } else {
          setTestResult({
            ok: false,
            message: `API key inválida o rechazada por ${providerInfo.name} (HTTP ${res.status}).`,
          });
        }
      }
    } catch {
      setTestResult({
        ok: false,
        message: `No se pudo validar desde el navegador (posible CORS o red). Levanta el backend FastAPI (:8000) para validar por servidor.`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleAddKeyword = (e) => {
    if (e.key === 'Enter' && newKeyword.trim()) {
      e.preventDefault();
      const kw = newKeyword.trim();
      if (!config.keywords.includes(kw)) {
        setConfig({ ...config, keywords: [...config.keywords, kw] });
      }
      setNewKeyword('');
    }
  };

  const handleAddKeywordClick = () => {
    const kw = newKeyword.trim();
    if (kw && !config.keywords.includes(kw)) {
      setConfig({ ...config, keywords: [...config.keywords, kw] });
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kw) => {
    setConfig({
      ...config,
      keywords: config.keywords.filter((item) => item !== kw),
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] text-emerald-400 uppercase tracking-wider">
            SYSTEM ENGINE CONFIG · v2.5-runtime
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 mt-0.5">
            Búsqueda de Trabajos & Configuración
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Parámetros del scraper Playwright, proveedor de IA (Gemini / DeepSeek) y directivas ATS.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Configuración sincronizada
            </span>
          )}
          <button
            onClick={onSaveConfig}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar Configuración
          </button>
          <button
            onClick={onRunSearch}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Buscar Vacantes Ahora
          </button>
        </div>
      </div>

      {/* Main 2-column config grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Scraping & Search Params */}
        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-5 space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
                <Search className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  Parámetros de Búsqueda y Scraping
                </h2>
                <p className="text-[11px] font-mono text-zinc-500">
                  Playwright Engine · LinkedIn Guest Worker
                </p>
              </div>
            </div>
            <span className="font-mono text-[11px] text-zinc-500">
              {config.keywords.length} configuradas
            </span>
          </div>

          {/* Keywords tags */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2">
              Keywords de búsqueda de empleo
            </label>
            <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-[#09090B] border border-zinc-800 min-h-[60px]">
              {config.keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-zinc-800/90 text-zinc-200 border border-zinc-700/70"
                >
                  {kw}
                  <button
                    onClick={() => handleRemoveKeyword(kw)}
                    className="text-zinc-400 hover:text-red-400 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={handleAddKeyword}
                placeholder="+ Agregar keyword (presiona Enter)"
                className="flex-1 bg-[#09090B] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                onClick={handleAddKeywordClick}
                className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/40 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modalidad / Zona preset: Local Tijuana | México Remoto | Ambos */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Modalidad de Búsqueda
            </label>
            <div className="grid grid-cols-3 bg-[#09090B] border border-zinc-800 rounded-lg p-1 text-xs mb-3">
              {[
                {
                  id: 'tijuana_local',
                  label: 'Local Tijuana',
                  loc: 'Tijuana, Baja California, Mexico',
                },
                {
                  id: 'mexico_remote',
                  label: 'México Remoto',
                  loc: 'Mexico',
                },
                {
                  id: 'both',
                  label: 'Tijuana + Remoto',
                  loc: 'Tijuana, Baja California, Mexico',
                },
              ].map((mode) => {
                const active = (config.work_mode || 'both') === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        work_mode: mode.id,
                        location: mode.loc,
                      })
                    }
                    className={`py-1.5 px-2 rounded-md font-medium transition cursor-pointer ${
                      active
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>

            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Ubicación / Modalidad
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={config.location}
                onChange={(e) =>
                  setConfig({ ...config, location: e.target.value })
                }
                className="w-full bg-[#09090B] border border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Time filter + Max per keyword */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Antigüedad de vacantes
              </label>
              <div className="grid grid-cols-3 bg-[#09090B] border border-zinc-800 rounded-lg p-1 text-xs">
                {[
                  { id: '24h', label: '24 horas' },
                  { id: '1w', label: '1 semana' },
                  { id: '1m', label: '1 mes' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setConfig({ ...config, time_filter: opt.id })}
                    className={`py-1.5 rounded-md font-medium transition cursor-pointer ${
                      config.time_filter === opt.id
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  Límite por keyword
                </label>
                <span className="font-mono text-[10px] text-zinc-500">
                  Max: 100
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={config.max_per_keyword}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      max_per_keyword: Number(e.target.value) || 10,
                    })
                  }
                  className="w-full bg-[#09090B] border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500/50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">
                  vacantes
                </span>
              </div>
            </div>
          </div>

          {/* Headless Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-[#09090B] border border-zinc-800/80">
            <div>
              <p className="text-xs font-medium text-zinc-200">
                Ejecutar navegador en modo headless
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Scraping no visual optimizado en segundo plano
              </p>
            </div>
            <button
              onClick={() => setConfig({ ...config, headless: !config.headless })}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                config.headless ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  config.headless ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Exclude English Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-[#09090B] border border-zinc-800/80">
            <div>
              <p className="text-xs font-medium text-zinc-200">
                Descartar vacantes en inglés / que pidan inglés
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Conserva únicamente ofertas en español sin requisito de inglés
              </p>
            </div>
            <button
              onClick={() =>
                setConfig({
                  ...config,
                  exclude_english: !(config.exclude_english ?? true),
                })
              }
              className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                (config.exclude_english ?? true) ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  (config.exclude_english ?? true)
                    ? 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Multi-source selector */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2">
              Plataformas de búsqueda activas
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SOURCE_OPTIONS.map((src) => {
                const activeSources = config.sources || ['linkedin', 'computrabajo', 'getonboard'];
                const checked = activeSources.includes(src.id);
                const toggleSource = () => {
                  const next = checked
                    ? activeSources.filter((s) => s !== src.id)
                    : [...activeSources, src.id];
                  if (next.length === 0) return;
                  setConfig({ ...config, sources: next });
                };
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={toggleSource}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition cursor-pointer ${
                      checked
                        ? 'bg-[#131817] border-emerald-500/45 text-zinc-100'
                        : 'bg-[#09090B] border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-medium leading-tight">{src.label}</p>
                      <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                        {src.hint}
                      </p>
                    </div>
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] font-bold ${
                        checked
                          ? 'bg-emerald-500 border-emerald-500 text-zinc-950'
                          : 'border-zinc-700 text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: AI Provider + API Key + Model + Prompt */}
        <div className="space-y-4">
          <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Configuración del Modelo de IA
                  </h2>
                  <p className="text-[11px] font-mono text-zinc-500">
                    {providerInfo.sdkLabel}
                  </p>
                </div>
              </div>
              <span className="font-mono text-[11px] text-emerald-400">
                • {providerInfo.name}
              </span>
            </div>

            {/* Provider Switcher: Gemini / DeepSeek */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Proveedor de IA
              </label>
              <div className="grid grid-cols-2 bg-[#09090B] border border-zinc-800 rounded-lg p-1 text-xs">
                <button
                  onClick={() => handleSelectProvider('gemini')}
                  className={`py-2 rounded-md font-semibold transition cursor-pointer ${
                    activeProviderKey === 'gemini'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  Google Gemini
                </button>
                <button
                  onClick={() => handleSelectProvider('deepseek')}
                  className={`py-2 rounded-md font-semibold transition cursor-pointer ${
                    activeProviderKey === 'deepseek'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  DeepSeek
                </button>
              </div>
            </div>

            {/* Model Cards for Selected Provider */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {providerInfo.models.map((m) => {
                const selected = config.ai_model === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setConfig({ ...config, ai_model: m.id })}
                    className={`text-left p-3.5 rounded-xl border transition cursor-pointer ${
                      selected
                        ? 'bg-[#131817] border-emerald-500/50'
                        : 'bg-[#09090B] border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-zinc-100">
                        {m.id}
                      </span>
                      <span
                        className={`w-3.5 h-3.5 rounded-full border ${
                          selected
                            ? 'border-emerald-400 bg-emerald-400'
                            : 'border-zinc-600'
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-emerald-400 mt-1">{m.badge}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">{m.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* API Key + Test Connection */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Credencial ({providerInfo.envName})
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={currentApiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder={providerInfo.placeholder}
                    className="w-full bg-[#09090B] border border-zinc-800 rounded-lg pl-9 pr-9 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    title={showKey ? 'Ocultar API key' : 'Mostrar API key'}
                  >
                    {showKey ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={testing}
                  onClick={handleTestConnection}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-zinc-900 border border-zinc-700/80 text-zinc-100 hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-50 transition cursor-pointer shrink-0"
                >
                  {testing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  {testing ? 'Validando...' : 'Testear Conexión'}
                </button>
              </div>

              {testResult && (
                <div
                  className={`mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                    testResult.ok
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            {/* Match threshold slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-zinc-300 font-medium">
                  Puntaje Mínimo de Match ATS
                </span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {config.min_match_score}% Match
                </span>
              </div>
              <input
                type="range"
                min={40}
                max={95}
                step={5}
                value={config.min_match_score}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    min_match_score: Number(e.target.value),
                  })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Batch size selector for Phase 02 token optimization */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-zinc-300 font-medium">
                  Vacantes por lote en Fase 02 (Ahorro de Tokens)
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  Deduplicación SQLite activa
                </span>
              </div>
              <div className="grid grid-cols-3 bg-[#09090B] border border-zinc-800 rounded-lg p-1 text-xs">
                {[
                  { value: 1, label: '1 · Individual' },
                  { value: 4, label: '4 · Óptimo (-70%)' },
                  { value: 6, label: '6 · Máx ahorro' },
                ].map((opt) => {
                  const active = Number(config.batch_size || 4) === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setConfig({ ...config, batch_size: opt.value })}
                      className={`py-1.5 px-2 rounded-md font-medium transition cursor-pointer ${
                        active
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Prompt Editor */}
          <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Editor de System Prompt ATS
                  </h2>
                  <p className="text-[11px] font-mono text-zinc-500">
                    prompts/ats_optimizer.txt
                  </p>
                </div>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                {prompt.length} caracteres
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['{cv_text}', '{jobs_json}', '{min_score}'].map((v) => (
                <span
                  key={v}
                  className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                >
                  {v}
                </span>
              ))}
            </div>

            <textarea
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-[#09090B] border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-200 leading-relaxed focus:outline-none focus:border-emerald-500/50"
            />

            <div className="flex items-center justify-between text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <RotateCcw className="w-3 h-3" />
                Salida validada con Pydantic JSON Schema
              </span>
              <span className="font-mono">Schema: ATSMatchPayload</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
