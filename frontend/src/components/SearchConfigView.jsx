import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  Search,
  MapPin,
  Plus,
  X,
  CheckCircle2,
  Play,
  Loader2,
  AlertCircle,
  Sparkles,
  Globe,
  ChevronDown,
} from 'lucide-react';

const LOCATION_SUGGESTIONS = [
  { label: 'Tijuana, Baja California, Mexico', aliases: ['tj', 'tijuana', 'bc'] },
  { label: 'Mexicali, Baja California, Mexico', aliases: ['mxl', 'mexicali', 'bc'] },
  { label: 'Ensenada, Baja California, Mexico', aliases: ['ensenada', 'bc'] },
  { label: 'Ciudad de México, Mexico', aliases: ['cdmx', 'df', 'ciudad de mexico'] },
  { label: 'Guadalajara, Jalisco, Mexico', aliases: ['gdl', 'guadalajara', 'jalisco'] },
  { label: 'Monterrey, Nuevo León, Mexico', aliases: ['mty', 'monterrey', 'nuevo leon'] },
  { label: 'Querétaro, Querétaro, Mexico', aliases: ['qro', 'queretaro'] },
  { label: 'Puebla, Puebla, Mexico', aliases: ['puebla'] },
  { label: 'Mérida, Yucatán, Mexico', aliases: ['merida', 'yucatan'] },
  { label: 'León, Guanajuato, Mexico', aliases: ['leon', 'guanajuato'] },
  { label: 'Hermosillo, Sonora, Mexico', aliases: ['hermosillo', 'sonora'] },
  { label: 'Chihuahua, Chihuahua, Mexico', aliases: ['chihuahua'] },
  { label: 'Saltillo, Coahuila, Mexico', aliases: ['saltillo', 'coahuila'] },
  { label: 'San Luis Potosí, SLP, Mexico', aliases: ['slp', 'san luis potosi'] },
  { label: 'Cancún, Quintana Roo, Mexico', aliases: ['cancun', 'quintana roo'] },
  { label: 'Aguascalientes, Aguascalientes, Mexico', aliases: ['ags', 'aguascalientes'] },
  { label: 'Toluca, Estado de México, Mexico', aliases: ['toluca', 'edomex'] },
  { label: 'Veracruz, Veracruz, Mexico', aliases: ['veracruz'] },
  { label: 'Morelia, Michoacán, Mexico', aliases: ['morelia', 'michoacan'] },
  { label: 'Culiacán, Sinaloa, Mexico', aliases: ['culiacan', 'sinaloa'] },
  { label: 'Mexico', aliases: ['mexico', 'remoto', 'remote', 'todo mexico'] },
];

function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const SOURCE_OPTIONS = [
  { id: 'linkedin', label: 'LinkedIn', hint: 'Playwright' },
  { id: 'computrabajo', label: 'Computrabajo MX', hint: 'Español / MX' },
  { id: 'indeed', label: 'Indeed MX', hint: 'Playwright' },
  { id: 'getonboard', label: 'Get on Board', hint: 'API Oficial' },
];

export default function SearchConfigView({
  config,
  setConfig,
  onSaveConfig,
  onRunSearch,
  savedNotice,
  apiConnected,
}) {
  const [newKeyword, setNewKeyword] = useState('');
  const [suggestingKeywords, setSuggestingKeywords] = useState(false);
  const [keywordSuggestInfo, setKeywordSuggestInfo] = useState(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const locationBoxRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (locationBoxRef.current && !locationBoxRef.current.contains(e.target)) {
        setLocationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredLocations = useMemo(() => {
    const q = normalizeText(config.location).trim();
    if (!q) return LOCATION_SUGGESTIONS;
    return LOCATION_SUGGESTIONS.filter((item) => {
      const normLabel = normalizeText(item.label);
      if (normLabel.includes(q)) return true;
      return item.aliases.some((alias) => alias.includes(q));
    });
  }, [config.location]);

  const handleSelectLocation = (locLabel) => {
    setConfig({ ...config, location: locLabel });
    setLocationOpen(false);
    setHighlightedIdx(0);
  };

  const handleLocationKeyDown = (e) => {
    if (!locationOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setLocationOpen(true);
      return;
    }
    if (!locationOpen || filteredLocations.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev + 1) % filteredLocations.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) =>
        prev === 0 ? filteredLocations.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = filteredLocations[highlightedIdx];
      if (picked) handleSelectLocation(picked.label);
    } else if (e.key === 'Escape') {
      setLocationOpen(false);
    }
  };

  const activeProviderKey = config.ai_provider === 'deepseek' ? 'deepseek' : 'gemini';
  const currentApiKey = config.api_keys?.[activeProviderKey] ?? '';

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

  const handleSuggestKeywordsFromCv = async () => {
    if (!apiConnected) {
      setKeywordSuggestInfo({
        ok: false,
        message: 'Conecta el backend FastAPI (:8000) para analizar tu CV con IA.',
      });
      return;
    }
    setSuggestingKeywords(true);
    setKeywordSuggestInfo(null);
    try {
      const res = await fetch('/api/ai/suggest-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeProviderKey,
          model: config.ai_model,
          api_key: currentApiKey.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setKeywordSuggestInfo({
          ok: false,
          message: data.detail || 'No se pudieron generar keywords desde el CV.',
        });
        return;
      }
      if (Array.isArray(data.keywords) && data.keywords.length > 0) {
        setConfig({
          ...config,
          keywords: data.keywords,
        });
        setKeywordSuggestInfo({
          ok: true,
          message: `Nivel detectado: ${data.detected_level} · ${data.detected_area} (${data.keywords.length} keywords adaptadas).`,
        });
      } else {
        setKeywordSuggestInfo({
          ok: false,
          message: 'La IA no devolvió keywords válidas.',
        });
      }
    } catch {
      setKeywordSuggestInfo({
        ok: false,
        message: 'Error de red comunicándose con FastAPI (:8000).',
      });
    } finally {
      setSuggestingKeywords(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] text-emerald-400 uppercase tracking-wider">
            PLAYWRIGHT & MULTI-SOURCE SCRAPING · v2.5-runtime
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 mt-0.5">
            Búsqueda de Trabajos
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Keywords de búsqueda, modalidad local o remota, filtros de idioma y plataformas activas.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Búsqueda guardada
            </span>
          )}
          <button
            onClick={onSaveConfig}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar Búsqueda
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

      {/* Main 2-column search grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Keywords + Location + Work Mode */}
        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-5 space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
                <Search className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  Keywords y Ubicación
                </h2>
                <p className="text-[11px] font-mono text-zinc-500">
                  Términos de búsqueda y zona objetivo
                </p>
              </div>
            </div>
            <span className="font-mono text-[11px] text-zinc-500">
              {config.keywords.length} configuradas
            </span>
          </div>

          {/* Keywords tags + AI Suggest */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-medium text-zinc-300">
                Keywords de búsqueda de empleo
              </label>
              <button
                type="button"
                disabled={suggestingKeywords}
                onClick={handleSuggestKeywordsFromCv}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 disabled:opacity-50 transition cursor-pointer"
                title="Analiza tu CV actual y genera keywords según tu experiencia y nivel"
              >
                {suggestingKeywords ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {suggestingKeywords ? 'Analizando CV...' : 'Sugerir con IA (CV)'}
              </button>
            </div>
            {keywordSuggestInfo && (
              <div
                className={`mb-2 flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg border ${
                  keywordSuggestInfo.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                {keywordSuggestInfo.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{keywordSuggestInfo.message}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-[#09090B] border border-zinc-800 min-h-[72px]">
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

          {/* Modalidad (Local / Remoto) + Comboselect de Ubicación */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Modalidad de Búsqueda
            </label>
            <div className="grid grid-cols-2 bg-[#09090B] border border-zinc-800 rounded-lg p-1 text-xs mb-3">
              {[
                {
                  id: 'local',
                  label: 'Local',
                  matches: (m) => m === 'local' || m === 'tijuana_local' || m === 'both',
                },
                {
                  id: 'mexico_remote',
                  label: 'Remoto',
                  matches: (m) => m === 'mexico_remote' || m === 'remote',
                },
              ].map((mode) => {
                const active = mode.matches(config.work_mode || 'local');
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        work_mode: mode.id,
                        location:
                          mode.id === 'mexico_remote'
                            ? 'Mexico'
                            : !config.location || config.location === 'Mexico'
                            ? 'Tijuana, Baja California, Mexico'
                            : config.location,
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
              Ubicación (escribe para autocompletar)
            </label>
            <div className="relative" ref={locationBoxRef}>
              <MapPin className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={config.location}
                onFocus={() => setLocationOpen(true)}
                onChange={(e) => {
                  setConfig({ ...config, location: e.target.value });
                  setLocationOpen(true);
                  setHighlightedIdx(0);
                }}
                onKeyDown={handleLocationKeyDown}
                placeholder="Ej. Tijuana, Guadalajara, Monterrey, CDMX..."
                className="w-full bg-[#09090B] border border-zinc-800 rounded-lg pl-9 pr-14 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {config.location && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfig({ ...config, location: '' });
                      setLocationOpen(true);
                    }}
                    className="p-1 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    title="Limpiar ubicación"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLocationOpen((prev) => !prev)}
                  className="p-1 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  title="Mostrar ubicaciones"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      locationOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>

              {locationOpen && (
                <div className="absolute z-30 mt-1.5 w-full max-h-56 overflow-y-auto rounded-xl bg-[#111114] border border-zinc-700/80 shadow-2xl py-1">
                  {filteredLocations.length > 0 ? (
                    filteredLocations.map((item, idx) => {
                      const isHighlighted = idx === highlightedIdx;
                      const isSelected = config.location === item.label;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onMouseEnter={() => setHighlightedIdx(idx)}
                          onClick={() => handleSelectLocation(item.label)}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition cursor-pointer ${
                            isHighlighted
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : isSelected
                              ? 'text-emerald-400 bg-zinc-900/60'
                              : 'text-zinc-300 hover:bg-zinc-900/80'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <MapPin className="w-3.5 h-3.5 shrink-0 opacity-60" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-2.5 text-xs text-zinc-400">
                      Usar ubicación personalizada:{' '}
                      <span className="text-emerald-400 font-medium">
                        &ldquo;{config.location}&rdquo;
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Sources + Scraping Limits + Filters */}
        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-5 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Plataformas y Parámetros de Scraping
              </h2>
              <p className="text-[11px] font-mono text-zinc-500">
                Filtros deterministas previos al análisis IA
              </p>
            </div>
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
        </div>
      </div>
    </div>
  );
}
