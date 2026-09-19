/**
 * themes.ts — Definiciones de paletas de color para Clio Reader
 *
 * Cada paleta define los tokens CSS para modo oscuro.
 * El modo claro es idéntico para todas las paletas (alabastro mármol).
 *
 * RGB decompositions permiten usar rgba() dinámicamente:
 *   rgba(var(--gold-rgb), .35)
 */

export interface ThemePalette {
  readonly id: string;
  readonly name: string;
  readonly dark: {
    readonly 'ink-950': string;
    readonly 'ink-900': string;
    readonly 'ink-850': string;
    readonly 'ink-800': string;
    readonly 'ink-700': string;
    readonly 'ink-600': string;
    readonly 'line': string;
    readonly 'gold': string;
    readonly 'gold-bright': string;
    readonly 'gold-dim': string;
    readonly 'verdigris': string;
    readonly 'verdigris-dim': string;
    readonly 'rose': string;
    readonly 'tx-hi': string;
    readonly 'tx': string;
    readonly 'tx-lo': string;
    readonly 'tx-faint': string;
    readonly 'on-gold': string;
    readonly 'accent-strong': string;
    readonly 'read-bg': string;
    readonly 'read-tx': string;
    readonly 'read-tx-lo': string;
    readonly 'gold-rgb': string;
    readonly 'verdigris-rgb': string;
    readonly 'ink950-rgb': string;
    readonly 'rose-rgb': string;
  };
}

/* --- Modo claro: idéntico para todas las paletas (alabastro mármol) --- */
export const LIGHT_DEFAULTS = {
  'ink-950': '#eceee9',
  'ink-900': '#f6f7f3',
  'ink-850': '#ffffff',
  'ink-800': '#e6e8e1',
  'ink-700': '#d7dace',
  'ink-600': '#c2c6b6',
  'line': '#e0e3d9',
  'tx-hi': '#1e2019',
  'tx': '#474a40',
  'tx-lo': '#7b7e70',
  'tx-faint': '#a6a897',
  'accent-strong': '#8a6d12',
} as const;

/* ==========================================================================
   10 PALETAS (extraídas de clio-0.html … clio-9.html)
   ========================================================================== */

const THEMES: readonly ThemePalette[] = [
  {
    id: 'clio-0',
    name: 'Teal',
    dark: {
      'ink-950': '#1f1e2d', 'ink-900': '#28273a', 'ink-850': '#31304a',
      'ink-800': '#37364e', 'ink-700': '#454363', 'ink-600': '#5b4a68',
      'line': '#3a3852',
      'gold': '#6aae9d', 'gold-bright': '#b9d4b4', 'gold-dim': '#3f7a6c',
      'verdigris': '#4f8290', 'verdigris-dim': '#355d69',
      'rose': '#9e8e91',
      'tx-hi': '#efe9dd', 'tx': '#cbc4ba', 'tx-lo': '#8b8598', 'tx-faint': '#6a657a',
      'on-gold': '#0f231e', 'accent-strong': '#b9d4b4',
      'read-bg': '#f4efe4', 'read-tx': '#2b2620', 'read-tx-lo': '#7a7266',
      'gold-rgb': '106,174,157', 'verdigris-rgb': '79,130,144',
      'ink950-rgb': '31,30,45', 'rose-rgb': '158,142,145',
    },
  },
  {
    id: 'clio-1',
    name: 'Earth',
    dark: {
      'ink-950': '#141a0d', 'ink-900': '#1d1d13', 'ink-850': '#29221a',
      'ink-800': '#3c2921', 'ink-700': '#4b2d28', 'ink-600': '#5f3d47',
      'line': '#443029',
      'gold': '#8ab0d8', 'gold-bright': '#aad8f7', 'gold-dim': '#5f80a1',
      'verdigris': '#7f7397', 'verdigris-dim': '#5c5370',
      'rose': '#96687f',
      'tx-hi': '#efe9dd', 'tx': '#cbc4ba', 'tx-lo': '#8b8598', 'tx-faint': '#6a657a',
      'on-gold': '#0f1b26', 'accent-strong': '#aad8f7',
      'read-bg': '#f4efe4', 'read-tx': '#2b2620', 'read-tx-lo': '#7a7266',
      'gold-rgb': '138,176,216', 'verdigris-rgb': '127,115,151',
      'ink950-rgb': '20,26,13', 'rose-rgb': '150,104,127',
    },
  },
  {
    id: 'clio-2',
    name: 'Plum',
    dark: {
      'ink-950': '#241e22', 'ink-900': '#2c2529', 'ink-850': '#342c31',
      'ink-800': '#3f343b', 'ink-700': '#4b3d44', 'ink-600': '#645355',
      'line': '#453a41',
      'gold': '#cca87b', 'gold-bright': '#ddcf99', 'gold-dim': '#a88a5e',
      'verdigris': '#5b7d73', 'verdigris-dim': '#445e56',
      'rose': '#9c524e',
      'tx-hi': '#efe9dd', 'tx': '#cbc4ba', 'tx-lo': '#8b8598', 'tx-faint': '#6a657a',
      'on-gold': '#2a2015', 'accent-strong': '#ddcf99',
      'read-bg': '#f4efe4', 'read-tx': '#2b2620', 'read-tx-lo': '#7a7266',
      'gold-rgb': '204,168,123', 'verdigris-rgb': '91,125,115',
      'ink950-rgb': '36,30,34', 'rose-rgb': '156,82,78',
    },
  },
  {
    id: 'clio-3',
    name: 'Forest',
    dark: {
      'ink-950': '#0b1412', 'ink-900': '#141d18', 'ink-850': '#1f2b24',
      'ink-800': '#28362d', 'ink-700': '#35473a', 'ink-600': '#445e4e',
      'line': '#2b3a30',
      'gold': '#a9ab3a', 'gold-bright': '#dfe0ba', 'gold-dim': '#826b24',
      'verdigris': '#85b396', 'verdigris-dim': '#5f8a71',
      'rose': '#8f5c3c',
      'tx-hi': '#efe9dd', 'tx': '#cbc4ba', 'tx-lo': '#8b8598', 'tx-faint': '#6a657a',
      'on-gold': '#2b1107', 'accent-strong': '#dfe0ba',
      'read-bg': '#f4efe4', 'read-tx': '#2b2620', 'read-tx-lo': '#7a7266',
      'gold-rgb': '169,171,58', 'verdigris-rgb': '133,179,150',
      'ink950-rgb': '11,20,18', 'rose-rgb': '143,92,60',
    },
  },
  {
    id: 'clio-4',
    name: 'Mauve',
    dark: {
      'ink-950': '#221a24', 'ink-900': '#2e222f', 'ink-850': '#392b3a',
      'ink-800': '#45293f', 'ink-700': '#574457', 'ink-600': '#665964',
      'line': '#3e3040',
      'gold': '#fbb954', 'gold-bright': '#f2ec8b', 'gold-dim': '#b3823c',
      'verdigris': '#788a87', 'verdigris-dim': '#576069',
      'rose': '#b0494e',
      'tx-hi': '#efe9dd', 'tx': '#cbc4ba', 'tx-lo': '#8b8598', 'tx-faint': '#6a657a',
      'on-gold': '#33200f', 'accent-strong': '#f2ec8b',
      'read-bg': '#f4efe4', 'read-tx': '#2b2620', 'read-tx-lo': '#7a7266',
      'gold-rgb': '251,185,84', 'verdigris-rgb': '120,138,135',
      'ink950-rgb': '34,26,36', 'rose-rgb': '176,73,78',
    },
  },
  {
    id: 'clio-5',
    name: 'Purple',
    dark: {
      'ink-950': '#100f18', 'ink-900': '#16141f', 'ink-850': '#1c1a28',
      'ink-800': '#232032', 'ink-700': '#2e2a40', 'ink-600': '#3b3652',
      'line': '#332f47',
      'gold': '#c9a24b', 'gold-bright': '#e6c874', 'gold-dim': '#8a7434',
      'verdigris': '#4fa393', 'verdigris-dim': '#2f6d61',
      'rose': '#c17b7b',
      'tx-hi': '#efe9dd', 'tx': '#cbc4ba', 'tx-lo': '#8b8598', 'tx-faint': '#6a657a',
      'on-gold': '#1a1710', 'accent-strong': '#e6c874',
      'read-bg': '#f4efe4', 'read-tx': '#2b2620', 'read-tx-lo': '#7a7266',
      'gold-rgb': '201,162,75', 'verdigris-rgb': '79,163,147',
      'ink950-rgb': '16,15,24', 'rose-rgb': '193,123,123',
    },
  },
  {
    id: 'clio-6',
    name: 'Slate',
    dark: {
      'ink-950': '#17171f', 'ink-900': '#1f1f29', 'ink-850': '#2b2a33',
      'ink-800': '#413a42', 'ink-700': '#4c4a56', 'ink-600': '#596070',
      'line': '#3a3944',
      'gold': '#96a2b3', 'gold-bright': '#eaf0d8', 'gold-dim': '#6c7688',
      'verdigris': '#7d8aa0', 'verdigris-dim': '#596070',
      'rose': '#8a8f9e',
      'tx-hi': '#efe9dd', 'tx': '#cbc4ba', 'tx-lo': '#8b8598', 'tx-faint': '#6a657a',
      'on-gold': '#1f1f29', 'accent-strong': '#eaf0d8',
      'read-bg': '#f4efe4', 'read-tx': '#2b2620', 'read-tx-lo': '#7a7266',
      'gold-rgb': '150,162,179', 'verdigris-rgb': '125,138,160',
      'ink950-rgb': '23,23,31', 'rose-rgb': '138,143,158',
    },
  },
  {
    id: 'clio-7',
    name: 'Violet',
    dark: {
      'ink-950': '#282234', 'ink-900': '#332b48', 'ink-850': '#3a3350',
      'ink-800': '#3c4059', 'ink-700': '#4c587e', 'ink-600': '#5f6a92',
      'line': '#413a5a',
      'gold': '#8977c9', 'gold-bright': '#bc8dff', 'gold-dim': '#6455a0',
      'verdigris': '#fc9bd3', 'verdigris-dim': '#c46a9e',
      'rose': '#8fd6e8',
      'tx-hi': '#efe9dd', 'tx': '#cbc4ba', 'tx-lo': '#8b8598', 'tx-faint': '#6a657a',
      'on-gold': '#1e162e', 'accent-strong': '#bc8dff',
      'read-bg': '#f4efe4', 'read-tx': '#2b2620', 'read-tx-lo': '#7a7266',
      'gold-rgb': '137,119,201', 'verdigris-rgb': '252,155,211',
      'ink950-rgb': '40,34,52', 'rose-rgb': '143,214,232',
    },
  },
  {
    id: 'clio-8',
    name: 'Black',
    dark: {
      'ink-950': '#000000', 'ink-900': '#141718', 'ink-850': '#222728',
      'ink-800': '#2c3331', 'ink-700': '#35443b', 'ink-600': '#3f5546',
      'line': '#2b3230',
      'gold': '#be9585', 'gold-bright': '#f3ebd4', 'gold-dim': '#8f6f63',
      'verdigris': '#5c7a66', 'verdigris-dim': '#3f5546',
      'rose': '#966f7a',
      'tx-hi': '#efe9dd', 'tx': '#cbc4ba', 'tx-lo': '#8b8598', 'tx-faint': '#6a657a',
      'on-gold': '#241713', 'accent-strong': '#f3ebd4',
      'read-bg': '#f4efe4', 'read-tx': '#2b2620', 'read-tx-lo': '#7a7266',
      'gold-rgb': '190,149,133', 'verdigris-rgb': '92,122,102',
      'ink950-rgb': '0,0,0', 'rose-rgb': '150,111,122',
    },
  },
  {
    id: 'clio-9',
    name: 'Neon',
    dark: {
      'ink-950': '#09010d', 'ink-900': '#17001d', 'ink-850': '#270022',
      'ink-800': '#360529', 'ink-700': '#450327', 'ink-600': '#660f31',
      'line': '#40122b',
      'gold': '#0098db', 'gold-bright': '#0ce6f2', 'gold-dim': '#1e579c',
      'verdigris': '#ff0546', 'verdigris-dim': '#9c173b',
      'rose': '#c33a60',
      'tx-hi': '#efe9dd', 'tx': '#cbc4ba', 'tx-lo': '#8b8598', 'tx-faint': '#6a657a',
      'on-gold': '#04212b', 'accent-strong': '#0ce6f2',
      'read-bg': '#f4efe4', 'read-tx': '#2b2620', 'read-tx-lo': '#7a7266',
      'gold-rgb': '0,152,219', 'verdigris-rgb': '255,5,70',
      'ink950-rgb': '9,1,13', 'rose-rgb': '195,58,96',
    },
  },
];

/* ==========================================================================
   API pública
   ========================================================================== */

/** Todas las paletas disponibles */
export const PALETTES = THEMES;

/** Buscar paleta por ID, fallback a clio-0 */
export function getPalette(id: string): ThemePalette {
  return THEMES.find((p) => p.id === id) ?? THEMES[0]!;
}

/** IDs de todas las paletas */
export const PALETTE_IDS = THEMES.map((p) => p.id);

/**
 * Aplica una paleta al DOM injectando CSS variables como inline style.
 * @param paletteId  ID de la paleta (ej: 'clio-3')
 * @param mode       'dark' | 'light'
 */
export function applyTheme(paletteId: string, mode: 'dark' | 'light'): void {
  // Apply to <html> so variables are available globally (including ReaderView)
  const html = document.documentElement;

  const palette = getPalette(paletteId);
  const src = mode === 'dark' ? palette.dark : LIGHT_DEFAULTS;

  // Inject CSS variables as inline style
  const cssVars: string[] = [];
  for (const [key, val] of Object.entries(src)) {
    cssVars.push(`--${key}:${val}`);
  }

  // RGB decompositions (always from dark palette, needed for rgba() in both modes)
  if (mode === 'light') {
    cssVars.push(`--gold-rgb:${palette.dark['gold-rgb']}`);
    cssVars.push(`--verdigris-rgb:${palette.dark['verdigris-rgb']}`);
    cssVars.push(`--ink950-rgb:${palette.dark['ink950-rgb']}`);
    cssVars.push(`--rose-rgb:${palette.dark['rose-rgb']}`);
  }

  html.style.cssText = cssVars.join(';');

  // Set data attribute for CSS selectors
  html.setAttribute('data-app-theme', mode);
  html.setAttribute('data-palette', paletteId);
}

/**
 * Guarda la preferencia en localStorage
 */
export function savePalettePreference(paletteId: string, mode: 'dark' | 'light'): void {
  localStorage.setItem('clio-palette', JSON.stringify({ id: paletteId, mode }));
}

/**
 * Carga la preferencia desde localStorage.
 * Retorna null si no hay preferencia guardada.
 */
export function loadPalettePreference(): { id: string; mode: 'dark' | 'light' } | null {
  try {
    const raw = localStorage.getItem('clio-palette');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && (parsed.mode === 'dark' || parsed.mode === 'light')) {
      return { id: parsed.id, mode: parsed.mode };
    }
  } catch { /* ignore */ }
  return null;
}
