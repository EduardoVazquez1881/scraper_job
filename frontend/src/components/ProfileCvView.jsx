import { useState } from 'react';
import { Save, Upload, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export default function ProfileCvView({
  cvText,
  setCvText,
  onSaveCv,
  onUploadPdf,
  savedNotice,
}) {
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');

    if (file.name.toLowerCase().endsWith('.pdf')) {
      setUploadingPdf(true);
      try {
        const res = await onUploadPdf?.(file);
        if (res && !res.ok) {
          setUploadError(res.error || 'No se pudo procesar el PDF.');
        }
      } finally {
        setUploadingPdf(false);
        e.target.value = '';
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCvText(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const lines = cvText.split('\n');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] text-emerald-400 uppercase tracking-wider">
            ATS DOCUMENT ENGINE · profile/cv.md
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 mt-0.5">
            Mi Perfil & CV
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Gestiona tu currículum base en formato Markdown para la optimización y cálculo de compatibilidad ATS.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <CheckCircle2 className="w-3.5 h-3.5" />
              CV guardado
            </span>
          )}
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#111114] text-zinc-200 border border-zinc-800 hover:border-emerald-500/40 cursor-pointer transition">
            {uploadingPdf ? (
              <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
            )}
            {uploadingPdf ? 'Extrayendo PDF...' : 'Subir CV (.pdf / .md / .txt)'}
            <input
              type="file"
              accept=".pdf,.md,.txt"
              disabled={uploadingPdf}
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <button
            onClick={onSaveCv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar CV
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* 2-column Markdown editor + rendered preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-zinc-800/80 flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>cv.md</span>
            <span>{cvText.length} caracteres · UTF-8</span>
          </div>
          <textarea
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
            rows={20}
            className="flex-1 w-full bg-[#09090B] p-4 font-mono text-xs text-zinc-200 leading-relaxed focus:outline-none resize-none"
          />
        </div>

        <div className="bg-[#111114] border border-zinc-800/80 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-zinc-800/80 flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>Vista previa ATS renderizada</span>
            <span className="text-emerald-400">Rol Base Validado</span>
          </div>
          <div className="p-5 space-y-2 text-sm text-zinc-300 overflow-y-auto max-h-[480px]">
            {lines.map((line, i) => {
              if (line.startsWith('# ')) {
                return (
                  <h2 key={i} className="text-xl font-bold text-zinc-50">
                    {line.slice(2)}
                  </h2>
                );
              }
              if (line.startsWith('## ')) {
                return (
                  <h3
                    key={i}
                    className="text-xs font-mono uppercase tracking-wider text-emerald-400 pt-3 border-b border-zinc-800 pb-1"
                  >
                    {line.slice(3)}
                  </h3>
                );
              }
              if (line.startsWith('### ')) {
                return (
                  <h4 key={i} className="text-sm font-semibold text-zinc-100 pt-2">
                    {line.slice(4)}
                  </h4>
                );
              }
              if (line.startsWith('- ')) {
                return (
                  <p key={i} className="text-xs text-zinc-300 pl-3 flex gap-2">
                    <span className="text-emerald-400">•</span>
                    <span>{line.slice(2).replace(/\*\*/g, '')}</span>
                  </p>
                );
              }
              if (!line.trim()) return <div key={i} className="h-1" />;
              return (
                <p key={i} className="text-xs text-zinc-400">
                  {line.replace(/[*]/g, '')}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
