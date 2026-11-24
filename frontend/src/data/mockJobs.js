export const INITIAL_CONFIG = {
  keywords: [
    'Backend Developer Python',
    'Full Stack Developer',
    'FastAPI Developer',
    'React & Node.js',
    'AI Engineer Junior',
  ],
  location: 'Tijuana, B.C. / Remoto (LATAM / US)',
  time_filter: '24h',
  max_per_keyword: 20,
  headless: true,
  exclude_english: true,
  work_mode: 'both',
  sources: ['linkedin', 'computrabajo', 'getonboard'],
  ai_provider: 'gemini',
  ai_model: 'gemini-2.5-flash',
  api_keys: {
    gemini: '',
    deepseek: '',
  },
  min_match_score: 80,
  temperature: 0.2,
};

export const INITIAL_CV = `# Eduardo Vázquez
**Desarrollador de Software | Backend & Full Stack**
*Tijuana, B.C., México | eduardovz1881@gmail.com | +52 664 219 5487*
*GitHub: github.com/EduardoVazquez1881 | Portafolio: eduardovazquez.online*

## Perfil Profesional
Ingeniero en Sistemas Computacionales con especialidad en Desarrollo de Software. Experiencia práctica en arquitectura backend, desarrollo full stack/móvil e integración de APIs de LLMs (Gemini 2.5 Flash, OpenAI, DeepSeek).

## Experiencia Técnica

### Desarrollador de Software | Freelance
*Abr 2026 – Jul 2026 | Tijuana, B.C.*
- Diseñé e implementé un pipeline de extracción y análisis semántico con Python, Playwright y Gemini 2.5 Flash para calcular compatibilidad ATS entre vacantes y perfiles.
- Estructuré salidas en JSON validado para generación dinámica de reportes HTML, reduciendo el tiempo manual de postulación en un 80%.

### Colaborador Técnico – Backend & Infraestructura | Proyecto DFIND
*Ene 2026 – May 2026 | Remoto*
- Documenté la arquitectura general, flujos de servicios y endpoints del backend en Node.js.
- Resolví incidencias críticas en producción en módulos de autenticación (auth), lógica de negocio (services) y utilidades.
- Estandaricé el entorno de ejecución local con Docker y Docker Compose.

## Stack Tecnológico
- **Lenguajes:** Python, TypeScript, JavaScript, SQL, C++, C#
- **Frameworks:** FastAPI, Node.js (Express), React, React Native (Expo), Electron, Next.js, Django, Tailwind CSS
- **Bases de Datos & DevOps:** PostgreSQL, SQLite, MySQL, Supabase, Docker, Docker Compose, Linux, Git`;

export const INITIAL_PROMPT = `Eres un Evaluador Senior de ATS y Reclutador Técnico especializado en el sector tech.
Tu objetivo es analizar la lista de ofertas de trabajo en {jobs_json} contra el currículum provisto en {cv_text}.

Para cada vacante realiza estrictamente:
1. Calcula un puntaje de compatibilidad numérica (0 a 100) basado en stack técnico, seniority y responsabilidades.
2. Identifica brechas críticas y 'missing keywords' ausentes en el CV.
3. Redacta 3 bullets optimizados de alto impacto utilizando la fórmula: Acción + Contexto + Resultado Cuantificable en negrita.`;

export const INITIAL_JOBS = [
  {
    id: 'job-1',
    initials: 'AN',
    title: 'Backend Developer (Python / FastAPI & AI)',
    company: 'ArkusNexus',
    location: 'Tijuana, B.C. · Híbrido / Remoto',
    salary: '$38k - $48k MXN / mes',
    matchScore: 94,
    keyword: 'FastAPI Developer',
    source: 'LinkedIn',
    postedAt: 'Hace 2h',
    link: 'https://www.linkedin.com/jobs/',
    applied: false,
    tags: ['Python', 'FastAPI', 'Gemini 2.5', 'Docker', 'PostgreSQL'],
    summary:
      'El puesto se alinea de forma sobresaliente con tu experiencia en pipelines de Python, FastAPI, Docker y salidas estructuradas con Gemini 2.5 Flash. Tu ubicación en Tijuana y experiencia práctica resolviendo incidencias de backend en producción te colocan en el percentil superior de candidatos.',
    gaps: ['Kubernetes / Helm', 'Redis Cache', 'CI/CD GitHub Actions'],
    gapSuggestion:
      'Integra al menos 2 de estas keywords en tus proyectos o sección de DevOps para elevar el parsing ATS al 98%.',
    bullets: [
      'Diseñé e implementé pipelines asíncronos en **Python y FastAPI** integrando **Gemini 2.5 Flash**, reduciendo el tiempo de análisis semántico de vacantes en un **80%** por lote procesado.',
      'Estandaricé entornos de desarrollo y pruebas locales mediante contenedores **Docker y Docker Compose**, acelerando el onboarding técnico y eliminando fallos de configuración en **100%** de los servicios.',
      'Diagnostiqué y resolví incidencias críticas en producción dentro de módulos de autenticación y lógica de negocio en APIs REST con **PostgreSQL y Node.js**.',
    ],
  },
  {
    id: 'job-2',
    initials: 'SF',
    title: 'Full Stack Software Engineer (React / Node.js)',
    company: 'Sonatafy Technology',
    location: 'Tijuana / Remoto (Nearshore US)',
    salary: '$42k - $55k MXN / mes',
    matchScore: 89,
    keyword: 'Full Stack Developer',
    source: 'LinkedIn',
    postedAt: 'Hace 4h',
    link: 'https://www.linkedin.com/jobs/',
    applied: false,
    tags: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker'],
    summary:
      'Alta compatibilidad con tu perfil Full Stack. Tus proyectos en React, TypeScript, Node.js y Supabase/PostgreSQL cubren el 90% de los requisitos técnicos de la vacante nearshore.',
    gaps: ['GraphQL', 'Jest / Testing Library'],
    gapSuggestion:
      'Menciona pruebas unitarias o integración en tus repositorios de React/Node para cubrir el criterio de calidad de código.',
    bullets: [
      'Desarrollé plataformas multiplataforma con **React, TypeScript y Tailwind CSS**, conectadas a bases de datos relacionales **PostgreSQL** con control de acceso por roles (RLS).',
      'Documenté arquitectura de servicios y endpoints REST en **Node.js (Express)**, reduciendo el tiempo de incorporación de nuevos colaboradores en un **50%**.',
      'Construí flujos interactivos en tiempo real y exportación automatizada de reportes **PDF/HTML** listos para clientes finales.',
    ],
  },
  {
    id: 'job-3',
    initials: 'FS',
    title: 'Junior AI & Automation Engineer',
    company: 'Framework Science',
    location: 'Remoto (LATAM / US PST)',
    salary: '$2,200 - $2,800 USD / mes',
    matchScore: 86,
    keyword: 'AI Engineer Junior',
    source: 'Get on Board',
    postedAt: 'Hace 6h',
    link: 'https://www.getonbrd.com/',
    applied: false,
    tags: ['Python', 'LLMs', 'Playwright', 'JSON Schema', 'FastAPI'],
    summary:
      'Excelente ajuste con tu experiencia freelance en scraping con Playwright y prompts estructurados en JSON con Gemini 2.5 Flash, además de tu app multimodal NutriAI.',
    gaps: ['LangGraph', 'Evaluaciones automáticas (Evals)'],
    gapSuggestion:
      'Destaca tus validaciones con Pydantic y el control de salidas deterministas (`temperature: 0.2`) en tu portafolio.',
    bullets: [
      'Implementé pipelines de automatización con **Python, Playwright y Gemini 2.5 Flash** para extracción web y scoring semántico automatizado con salidas en **JSON validado**.',
      'Desarrollé **NutriAI**, aplicación móvil multimodal con **Expo y Gemini Vision** capaz de identificar ingredientes y porciones en tiempo real sin alucinaciones.',
      'Integré arquitecturas cliente-servidor containerizadas con **FastAPI y Docker** para ejecutar workflows de IA bajo demanda.',
    ],
  },
  {
    id: 'job-4',
    initials: 'BW',
    title: 'React Native / Mobile Full Stack Developer',
    company: 'Bajaware Solutions',
    location: 'Tijuana, B.C. · Híbrido',
    salary: '$32k - $40k MXN / mes',
    matchScore: 83,
    keyword: 'React & Node.js',
    source: 'LinkedIn',
    postedAt: 'Ayer',
    link: 'https://www.linkedin.com/jobs/',
    applied: false,
    tags: ['React Native', 'Expo', 'TypeScript', 'Supabase', 'Push Notifications'],
    summary:
      'Tu plataforma de seguimiento TEA (`residencia_TDA`) demuestra exactamente el stack que buscan: Expo Router, soporte Web + Mobile, Supabase Realtime, RLS y generación de PDF.',
    gaps: ['React Native Reanimated avanzado', 'EAS Build CI/CD'],
    gapSuggestion:
      'Agrega el enlace directo a `residencia_TDA` en tu postulación; las capturas reales del README destacan mucho.',
    bullets: [
      'Diseñé y construí una aplicación multiplataforma (iOS, Android y Web) con **React Native, Expo y TypeScript** para seguimiento colaborativo por roles.',
      'Implementé autenticación, notificaciones en tiempo real (**Supabase Realtime**), alertas **Push** y políticas **Row Level Security (RLS)** en PostgreSQL.',
      'Desarrollé un constructor dinámico de plantillas de **4 pasos** y exportación a **PDF institucional** con persistencia local de borradores.',
    ],
  },
  {
    id: 'job-5',
    initials: 'DL',
    title: 'Software Engineer (Python / Backend)',
    company: 'Deel',
    location: 'Remoto (LATAM)',
    salary: '$2,500 - $3,400 USD / mes',
    matchScore: 74,
    keyword: 'Backend Developer Python',
    source: 'Wellfound',
    postedAt: 'Hace 2 días',
    link: 'https://wellfound.com/',
    applied: false,
    tags: ['Python', 'PostgreSQL', 'Docker', 'AWS', 'REST APIs'],
    summary:
      'Buen match en fundamentos de Python, SQL y Docker. El rol pide algo más de experiencia en infraestructura AWS y pruebas automatizadas en CI/CD.',
    gaps: ['AWS (ECS / Lambda)', 'Pytest Coverage > 80%', 'Terraform'],
    gapSuggestion:
      'Postúlate resaltando tu experiencia con Docker y tu capacidad demostrada para resolver incidentes reales en producción.',
    bullets: [
      'Construí y mantuve servicios backend en **Python y Node.js** con modelado relacional optimizado en **PostgreSQL y SQLite**.',
      'Contenericé flujos completos de ejecución y pruebas con **Docker y Docker Compose**, asegurando paridad entre desarrollo y producción.',
      'Resolví fallos críticos en módulos de autenticación y servicios centrales bajo presión operativa.',
    ],
  },
];
