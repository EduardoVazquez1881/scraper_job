export const INITIAL_CONFIG = {
  keywords: [
    'Desarrollador Backend Python',
    'Desarrollador Full Stack',
    'Desarrollador FastAPI',
    'Desarrollador React',
  ],
  location: 'Ciudad de México, Mexico',
  time_filter: '1w',
  max_per_keyword: 15,
  headless: true,
  exclude_english: true,
  work_mode: 'both',
  sources: ['linkedin', 'computrabajo', 'getonboard'],
  ai_provider: 'gemini',
  ai_model: 'gemini-2.5-flash',
  batch_size: 4,
  api_keys: {
    gemini: '',
    deepseek: '',
  },
  keys_configured: {
    gemini: false,
    deepseek: false,
  },
  keys_masked: {
    gemini: '',
    deepseek: '',
  },
  alert_secrets: {
    discord_webhook: '',
    telegram_token: '',
    telegram_chat_id: '',
  },
  min_match_score: 75,
  alert_min_score: 85,
  schedule_enabled: false,
  schedule_interval_hours: 12,
  temperature: 0.2,
};

export const INITIAL_CV = `# Nombre Apellido
**Desarrollador de Software | Backend & Full Stack**
*Ciudad de México, México · correo@ejemplo.com · github.com/tu-usuario*

## Perfil Profesional
Ingeniero de Software con experiencia práctica en desarrollo backend, interfaces web y automatización de datos con APIs de IA generativa.

## Experiencia Técnica

### Desarrollador Backend | Proyecto Demo
*2025 – Actualidad | Remoto*
- Diseñé e implementé APIs REST con Python y FastAPI aplicando validación de datos con Pydantic y persistencia en SQLite/PostgreSQL.
- Automatizé flujos de extracción y análisis estructurado reduciendo tiempos manuales de revisión en un 75%.
- Contenericé servicios de frontend y backend mediante Docker y Docker Compose.

## Stack Tecnológico
- **Lenguajes:** Python, TypeScript, JavaScript, SQL
- **Frameworks:** FastAPI, Node.js, React, Tailwind CSS
- **Bases de Datos & DevOps:** PostgreSQL, SQLite, Docker, Linux, Git`;

export const INITIAL_PROMPT = `Eres un Evaluador Senior de ATS y Reclutador Técnico especializado en el sector tech.
Tu objetivo es analizar la lista de ofertas de trabajo en {jobs_json} contra el currículum provisto en {cv_text}.

Para cada vacante realiza estrictamente:
1. Calcula un puntaje de compatibilidad numérica (0 a 100) basado en stack técnico, seniority y responsabilidades.
2. Identifica brechas críticas y 'missing keywords' ausentes en el CV.
3. Redacta 3 bullets optimizados de alto impacto utilizando la fórmula: Acción + Contexto + Resultado Cuantificable en negrita.`;

export const INITIAL_JOBS = [
  {
    id: 'job-1',
    initials: 'NT',
    title: 'Backend Developer (Python / FastAPI)',
    company: 'NovaTech Solutions',
    location: 'Remoto · México',
    salary: '$35k - $45k MXN / mes',
    matchScore: 92,
    keyword: 'Desarrollador FastAPI',
    source: 'Get on Board',
    postedAt: 'Hace 3h',
    link: 'https://www.getonbrd.com/',
    applied: false,
    status: 'pending',
    notes: '',
    tags: ['Python', 'FastAPI', 'Docker', 'PostgreSQL'],
    summary:
      'Alta compatibilidad con el stack principal del perfil en Python, FastAPI, validación con Pydantic y contenedores Docker.',
    gaps: ['Redis Cache', 'GitHub Actions CI/CD'],
    gapSuggestion:
      'Menciona pruebas automatizadas o pipelines de integración continua para elevar el puntaje ATS.',
    bullets: [
      'Desarrollé servicios asíncronos en **Python y FastAPI** con validación estricta en **Pydantic**, reduciendo tiempos de respuesta en un **40%**.',
      'Estandaricé entornos de desarrollo y despliegue local mediante **Docker y Docker Compose**, asegurando paridad operativa del **100%**.',
      'Modelé esquemas relacionales y consultas optimizadas en **PostgreSQL y SQLite** para paneles analíticos de alto tráfico.',
    ],
  },
  {
    id: 'job-2',
    initials: 'CD',
    title: 'Desarrollador Full Stack (React + Python)',
    company: 'CloudData MX',
    location: 'Ciudad de México · Híbrido',
    salary: '$38k - $50k MXN / mes',
    matchScore: 86,
    keyword: 'Desarrollador Full Stack',
    source: 'LinkedIn',
    postedAt: 'Hace 6h',
    link: 'https://www.linkedin.com/jobs/',
    applied: false,
    status: 'pending',
    notes: '',
    tags: ['React', 'TypeScript', 'Python', 'Tailwind CSS'],
    summary:
      'Buena alineación entre experiencia frontend en React/Tailwind y construcción de APIs REST en Python.',
    gaps: ['GraphQL', 'Playwright E2E Testing'],
    gapSuggestion:
      'Destaca proyectos que combinen consumo de APIs REST con manejo de estado y componentes reutilizables.',
    bullets: [
      'Construí interfaces modulares con **React y Tailwind CSS** integradas con backends en **Python**, mejorando la velocidad de carga percibida.',
      'Implementé endpoints REST documentados automáticamente con **OpenAPI/Swagger** para consumo entre equipos.',
      'Automatizé generación y exportación de documentos dinámicos en formatos **PDF y DOCX** desde el servidor.',
    ],
  },
];
