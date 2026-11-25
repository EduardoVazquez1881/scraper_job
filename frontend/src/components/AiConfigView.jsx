import { useState } from 'react';
import {
  Save,
  Cpu,
  Terminal,
  CheckCircle2,
  RotateCcw,
  KeyRound,
  Eye,
  EyeOff,
  Zap,
  Loader2,
  AlertCircle,
  ShieldCheck,
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

export default function AiConfigView({
  config,
  setConfig,
  prompt,
  setPrompt,
  onSaveConfig,
  savedNotice,
  apiConnected,
}) {
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const activeProviderKey = config.ai_provider === 'deepseek' ? 'deepseek' : 'gemini';
  const providerInfo = PROVIDERS[activeProviderKey];
  const currentApiKey = config.api_keys?.[activeProviderKey] ?? '';
  const isKeySavedInEnv = Boolean(config.keys_configured?.[activeProviderKey]);
  const maskedSavedKey = config.keys_masked?.[activeProviderKey] || '';

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
        if (data.ok && data.saved_encrypted) {
          setConfig({
            ...config,
            api_keys: { ...(config.api_keys || {}), [activeProviderKey]: '' },
            keys_configured: {
              ...(config.keys_configured || {}),
              [activeProviderKey]: true,
            },
            keys_masked: {
              ...(config.keys_masked || {}),
              [activeProviderKey]: data.masked_key || maskedSavedKey,
            },
          });
        }
        setTestResult({
          ok: Boolean(data.ok),
          message: data.message || (data.ok ? 'Conexión válida.' : 'Error de validación.'),
        });
      } else {
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
        message:
          'No se pudo validar desde el navegador. Levanta el backend FastAPI (:8000) para validar por servidor.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] text-emerald-400 uppercase tracking-wider">
            AI ENGINE & SYSTEM PROMPT · v2.5-runtime
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 mt-0.5">
            Configuración de IA y Prompt ATS
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Proveedor (Gemini / DeepSeek), credenciales locales en .env, tamaño de lote y reglas de evaluación ATS.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Configuración guardada
            </span>
          )}
          <button
            onClick={onSaveConfig}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar Configuración
          </button>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: AI Provider + API Key + Thresholds */}
        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  Proveedor y Modelo de IA
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

          {/* Provider Switcher */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Proveedor activo
            </label>
            <div className="grid grid-cols-2 bg-[#09090B] border border-zinc-800 rounded-lg p-1 text-xs">
              <button
                type="button"
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
                type="button"
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

          {/* Model Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {providerInfo.models.map((m) => {
              const selected = config.ai_model === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
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
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Credencial local ({providerInfo.envName})
              </label>
              {isKeySavedInEnv ? (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  <ShieldCheck className="w-3 h-3" />
                  Encriptada en .env {maskedSavedKey ? `· ${maskedSavedKey}` : ''}
                </span>
              ) : (
                <span className="font-mono text-[10px] text-amber-400">
                  Sin configurar en .env
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showKey ? 'text' : 'password'}
                  value={currentApiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder={
                    isKeySavedInEnv
                      ? 'Clave encriptada activa en .env (escribe solo para cambiarla)'
                      : providerInfo.placeholder
                  }
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

          {/* Batch size selector */}
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

        {/* Right: Prompt Editor */}
        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
                <Terminal className="w-4 h-4" />
              </div>
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
            rows={14}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 w-full bg-[#09090B] border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-200 leading-relaxed focus:outline-none focus:border-emerald-500/50 resize-y"
          />

          <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
            <span className="inline-flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Salida validada con Pydantic JSON Schema
            </span>
            <span className="font-mono">Schema: ATSMatchPayload</span>
          </div>
        </div>
      </div>
    </div>
  );
}
