(() => {
  const ClioSite = (window.ClioSite = window.ClioSite || {});

  const DYNAMIC = {
    en: {
      loading: 'checking releases…',
      published: 'published',
      notFound: 'no release yet',
      recommended: 'your system',
      download: 'download',
      size: 'size',
      file: 'file',
      notIn: 'not in this release',
      noNotes: 'This release has no notes.',
      noFiles: 'no files',
      heroFor: 'download for',
      allFiles: 'see the downloads',
      latest: 'latest release',
      osMac: 'No macOS build yet: Clio runs on Windows and Linux.',
      osMobile: 'Clio is a desktop app for Windows and Linux.',
      copy: 'copy',
      copied: 'copied',
      platforms: {
        'windows-exe': {
          os: 'Windows',
          kind: 'EXE',
          hint: 'NSIS installer · x64',
          desc: 'The usual way on Windows: run it and follow the steps.',
        },
        'linux-appimage': {
          os: 'Linux',
          kind: 'AppImage',
          hint: 'runs without installing · x64',
          desc: 'One file that works on most distributions. Nothing to install.',
        },
        'linux-deb': {
          os: 'Linux',
          kind: 'DEB',
          hint: 'debian, ubuntu and derivatives · x64',
          desc: 'A regular package for Debian-based systems.',
        },
      },
    },
    es: {
      loading: 'consultando releases…',
      published: 'publicada el',
      notFound: 'todavía no hay release',
      recommended: 'tu sistema',
      download: 'descargar',
      size: 'tamaño',
      file: 'archivo',
      notIn: 'no está en esta versión',
      noNotes: 'Esta versión no tiene notas.',
      noFiles: 'sin archivos',
      heroFor: 'descargar para',
      allFiles: 'ver las descargas',
      latest: 'última versión',
      osMac: 'Todavía no hay versión para macOS: Clio funciona en Windows y Linux.',
      osMobile: 'Clio es una app de escritorio para Windows y Linux.',
      copy: 'copiar',
      copied: 'copiado',
      platforms: {
        'windows-exe': {
          os: 'Windows',
          kind: 'EXE',
          hint: 'instalador NSIS · x64',
          desc: 'Lo habitual en Windows: ejecútalo y sigue los pasos.',
        },
        'linux-appimage': {
          os: 'Linux',
          kind: 'AppImage',
          hint: 'se ejecuta sin instalar · x64',
          desc: 'Un solo archivo que funciona en casi todas las distribuciones. Nada que instalar.',
        },
        'linux-deb': {
          os: 'Linux',
          kind: 'DEB',
          hint: 'debian, ubuntu y derivadas · x64',
          desc: 'Un paquete normal para sistemas basados en Debian.',
        },
      },
    },
  };

  const STATIC_ES = {
    skip: 'Saltar al contenido',
    live: 'última',
    ticker:
      '<span>sin cuenta <em>✳</em></span><span>funciona sin conexión <em>✳</em></span>' +
      '<span>epub · pdf · markdown · cbz <em>✳</em></span>' +
      '<span>notas ancladas al texto <em>✳</em></span>' +
      '<span>resaltados en 6 colores <em>✳</em></span>' +
      '<span>exporta a markdown, listo para obsidian <em>✳</em></span>' +
      '<span>windows · linux <em>✳</em></span>' +
      '<span>plugin de obsidian en camino <em>✳</em></span>',
    n1: 'archivos',
    n2: 'novedades',
    n3: 'instalar',
    n4: 'verificar',
    eb: 'descargas',
    h1a: 'Tu biblioteca.',
    h1b: 'Tu dispositivo.',
    lead: 'Sin cuentas, sin nube. Lee EPUB, PDF, CBZ y Markdown, y exporta tus notas como Markdown, listas para Obsidian.',
    cta1: 'ver las descargas',
    cta2: 'ver en github',
    loading: 'consultando releases…',
    noteb: 'biblioteca local<br>sin nube',
    strip2: 'código abierto <em>✳</em> local first <em>✳</em> sin drm',
    demo: 'datos de ejemplo · esta no es una versión real',
    s1a: '01 — elige tu archivo',
    s1b: 'última versión',
    sumsTxt: 'cada versión trae su archivo de verificación',
    nomac: 'Todavía no hay versión para macOS.',
    u1: 'Descarga todavía no disponible',
    u2: 'Todavía no hay una versión publicada de Clio Reader, o no se pudo consultar GitHub. El historial siempre está en GitHub.',
    u3: 'abrir releases en github',
    bn: 'novedades',
    s2a: '02 — notas de la versión',
    s2b: 'desde github releases',
    relLink: 'leerlas en github ↗',
    bi1: 'descargar',
    bi2: 'instalar',
    bi3: 'leer',
    s3a: '03 — instalar',
    s3b: 'un minuto, sin cuenta',
    exe: 'instalador nsis',
    w1: '# ejecuta el instalador y sigue los pasos',
    w2: 'Ejecútalo y sigue los pasos del instalador. No necesitas cuenta.',
    ai: 'cualquier linux · x64',
    ai2: 'Nada que instalar: dale permiso de ejecución y ábrelo.',
    deb: 'debian · ubuntu · x64',
    deb2: 'Lo instala con el gestor de paquetes de tu sistema.',
    copy: 'copiar',
    s4a: '04 — verificar',
    s4b: 'opcional, recomendado',
    vst: 'Comprueba que el archivo que bajaste <em>es el que se publicó.</em>',
    vp: 'Descarga <strong>SHA256SUMS.txt</strong> en la misma carpeta que el archivo y ejecuta el comando de tu sistema. Si el hash coincide, el archivo está intacto.',
    vw2: 'En Windows, compara el hash que aparece con la línea del mismo archivo en SHA256SUMS.txt.',
    s5a: '05 — versiones anteriores',
    s5b: 'todos los archivos, todas las versiones',
    ft: 'Clio Reader es una aplicación local-first de código abierto.',
    lab: 'un lab de jhosno ↗',
  };

  const TOGGLE = {
    en: { label: 'ES', aria: 'Cambiar a español' },
    es: { label: 'EN', aria: 'Switch to English' },
  };

  const STORAGE_KEY = 'jh-lang';

  let currentLang = 'en';
  const baseText = {};
  const baseHtml = {};

  function t(key) {
    return DYNAMIC[currentLang][key];
  }

  function getLang() {
    return currentLang;
  }

  function captureBaseStrings() {
    for (const el of document.querySelectorAll('[data-i18n]')) {
      const key = el.getAttribute('data-i18n');
      if (!(key in baseText)) baseText[key] = el.textContent;
    }
    for (const el of document.querySelectorAll('[data-i18n-html]')) {
      baseHtml[el.getAttribute('data-i18n-html')] = el.innerHTML;
    }
  }

  function readSavedLang() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function saveLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      return;
    }
  }

  function applyLanguage(lang, button, onChange) {
    currentLang = lang;
    document.documentElement.setAttribute('lang', lang);
    for (const el of document.querySelectorAll('[data-i18n]')) {
      const key = el.getAttribute('data-i18n');
      const value = lang === 'es' ? STATIC_ES[key] : baseText[key];
      if (value != null) el.textContent = value;
    }
    for (const el of document.querySelectorAll('[data-i18n-html]')) {
      const key = el.getAttribute('data-i18n-html');
      const value = lang === 'es' ? STATIC_ES[key] : baseHtml[key];
      if (value != null) el.innerHTML = value;
    }
    button.textContent = TOGGLE[lang].label;
    button.setAttribute('aria-label', TOGGLE[lang].aria);
    saveLang(lang);
    onChange();
  }

  function setupLanguage(button, onChange) {
    captureBaseStrings();
    button.addEventListener('click', () => {
      applyLanguage(currentLang === 'en' ? 'es' : 'en', button, onChange);
    });
    const browserLang = (navigator.language || 'en').slice(0, 2).toLowerCase();
    const initial = readSavedLang() || (browserLang === 'es' ? 'es' : 'en');
    applyLanguage(initial, button, onChange);
  }

  ClioSite.i18n = { t, getLang, setupLanguage };
})();
