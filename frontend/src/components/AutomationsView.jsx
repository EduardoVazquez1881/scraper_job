import { useState } from 'react';
import {
  Bell,
  Clock,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

export default function AutomationsView({
  config,
  setConfig,
  onSaveConfig,
  savedNotice,
  apiConnected,
}) {
  const [showAlertSecrets, setShowAlertSecrets] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [alertTestResult, setAlertTestResult] = useState(null);

  const handleAlertSecretChange = (field, value) => {
    setConfig({
      ...config,
      alert_secrets: {
        ...(config.alert_secrets || {}),
        [field]: value,
      },
    });
    if (alertTestResult) setAlertTestResult(null);
  };

  const handleTestAlert = async () => {
    if (!apiConnected) {
      setAlertTestResult({
        ok: false,
        message: 'Levanta el backend FastAPI (:8000) para enviar alertas de prueba.',
      });
      return;
    }
    setTestingAlert(true);
    setAlertTestResult(null);
    try {
      const secrets = config.alert_secrets || {};
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discord_webhook: secrets.discord_webhook || '',
          telegram_token: secrets.telegram_token || '',
          telegram_chat_id: secrets.telegram_chat_id || '',
        }),
      });
      const data = await res.json();
      setAlertTestResult({
        ok: Boolean(data.ok),
        message:
          data.message ||
          (data.ok ? 'Alerta de prueba enviada.' : 'No se pudo enviar la alerta.'),
      });
    } catch {
      setAlertTestResult({
        ok: false,
        message: 'Error de red comunicándose con FastAPI (:8000).',
      });
    } finally {
      setTestingAlert(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] text-emerald-400 uppercase tracking-wider">
            SCHEDULER & WEBHOOK ALERTS · v2.5-runtime
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 mt-0.5">
            Automatizaciones y Alertas
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Programa búsquedas automáticas en segundo plano y recibe avisos en Discord o Telegram para vacantes de alto match.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Automatización guardada
            </span>
          )}
          <button
            onClick={onSaveConfig}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar Automatización
          </button>
        </div>
      </div>

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Scheduler */}
        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  Ejecución Programada en Segundo Plano
                </h2>
                <p className="text-[11px] font-mono text-zinc-500">
                  FastAPI Background Scheduler · SQLite Dedup
                </p>
              </div>
            </div>
            <span
              className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                config.schedule_enabled
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-800'
              }`}
            >
              {config.schedule_enabled ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-lg bg-[#09090B] border border-zinc-800/80">
            <div>
              <p className="text-xs font-medium text-zinc-200">
                Activar búsqueda automática periódica
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Ejecuta Fase 01 + Fase 02 automáticamente mientras el backend local esté encendido
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setConfig({
                  ...config,
                  schedule_enabled: !config.schedule_enabled,
                })
              }
              className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                config.schedule_enabled ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  config.schedule_enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Frecuencia de ejecución
            </label>
            <div className="grid grid-cols-3 bg-[#09090B] border border-zinc-800 rounded-lg p-1 text-xs">
              {[
                { hours: 6, label: 'Cada 6 horas' },
                { hours: 12, label: 'Cada 12 horas' },
                { hours: 24, label: 'Cada 24 horas' },
              ].map((opt) => {
                const active = Number(config.schedule_interval_hours || 12) === opt.hours;
                return (
                  <button
                    key={opt.hours}
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        schedule_interval_hours: opt.hours,
                      })
                    }
                    className={`py-2 rounded-md font-medium transition cursor-pointer ${
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

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-zinc-300 font-medium">
                Umbral mínimo para disparar alerta
              </span>
              <span className="font-mono text-emerald-400 font-semibold">
                {config.alert_min_score ?? 85}% Match
              </span>
            </div>
            <input
              type="range"
              min={70}
              max={95}
              step={5}
              value={config.alert_min_score ?? 85}
              onChange={(e) =>
                setConfig({
                  ...config,
                  alert_min_score: Number(e.target.value),
                })
              }
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-zinc-500 mt-1.5">
              Solo se enviará notificación por vacantes nuevas que igualen o superen este porcentaje de afinidad ATS.
            </p>
          </div>
        </div>

        {/* Right: Discord & Telegram Webhooks */}
        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  Canales de Notificación (Discord / Telegram)
                </h2>
                <p className="text-[11px] font-mono text-zinc-500">
                  Webhooks privados almacenados en .env local
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {config.alerts_configured?.discord && (
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  Discord en .env
                </span>
              )}
              {config.alerts_configured?.telegram && (
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  Telegram en .env
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Discord Webhook URL (opcional)
              </label>
              <button
                type="button"
                onClick={() => setShowAlertSecrets((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                {showAlertSecrets ? (
                  <>
                    <EyeOff className="w-3 h-3" /> Ocultar
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3" /> Mostrar
                  </>
                )}
              </button>
            </div>
            <input
              type={showAlertSecrets ? 'text' : 'password'}
              value={config.alert_secrets?.discord_webhook ?? ''}
              onChange={(e) => handleAlertSecretChange('discord_webhook', e.target.value)}
              placeholder={
                config.alerts_configured?.discord
                  ? 'Configurado en .env (pega uno nuevo para reemplazar)'
                  : 'https://discord.com/api/webhooks/...'
              }
              className="w-full bg-[#09090B] border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Telegram Bot Token (opcional)
              </label>
              <input
                type={showAlertSecrets ? 'text' : 'password'}
                value={config.alert_secrets?.telegram_token ?? ''}
                onChange={(e) => handleAlertSecretChange('telegram_token', e.target.value)}
                placeholder={
                  config.alerts_configured?.telegram
                    ? 'Configurado en .env'
                    : '123456:ABC-DEF...'
                }
                className="w-full bg-[#09090B] border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Telegram Chat ID
              </label>
              <input
                type={showAlertSecrets ? 'text' : 'password'}
                value={config.alert_secrets?.telegram_chat_id ?? ''}
                onChange={(e) => handleAlertSecretChange('telegram_chat_id', e.target.value)}
                placeholder="Ej. 987654321"
                className="w-full bg-[#09090B] border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Nunca se suben credenciales a config.json ni a Git.
            </span>

            <button
              type="button"
              disabled={testingAlert}
              onClick={handleTestAlert}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-zinc-900 border border-zinc-700/80 text-zinc-100 hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-50 transition cursor-pointer"
            >
              {testingAlert ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Bell className="w-3.5 h-3.5 text-emerald-400" />
              )}
              {testingAlert ? 'Enviando prueba...' : 'Probar Alerta'}
            </button>
          </div>

          {alertTestResult && (
            <div
              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                alertTestResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              {alertTestResult.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{alertTestResult.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
