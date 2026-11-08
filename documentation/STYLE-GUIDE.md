# Clio Reader — Style Guide

Referencia de diseño para el equipo. Toda UI nueva debe seguir estos tokens y
patrones exactos. No inventar valores; si algo no está documentado, preguntar
antes de implementar.

---

## 1. Paleta de colores

### Sistema de temas

La app soporta **10 paletas de color** × **2 modos** (dark/light) = 20 combinaciones.
Cada paleta redefine los tokens CSS. El light mode es idéntico para todas.

### Tokens de paleta (dark mode)

| Token             | Rol                        | Ejemplo (clio-3 Forest) |
| ----------------- | -------------------------- | ----------------------- |
| `--ink-950`       | Fondo principal            | `#0b1412`               |
| `--ink-900`       | Rail / sidebar             | `#121e19`               |
| `--ink-850`       | Chips, inputs, badges      | `#1a2b23`               |
| `--ink-800`       | Tooltips, bordes internos  | `#22362c`               |
| `--ink-700`       | Superficie intermedia      | `#2b4136`               |
| `--ink-600`       | Superficie ligera          | `#364f42`               |
| `--ink-500`       | Bordes activos             | `#476354`               |
| `--line`          | Bordes                     | `#2b3a30`               |
| `--gold`          | Acento primario            | `#a9ab3a`               |
| `--gold-bright`   | Gradiente superior         | `#c8c95e`               |
| `--gold-dim`      | Acento apagado             | `#8a8c2f`               |
| `--verdigris`     | Acento secundario          | `#85b396`               |
| `--verdigris-dim` | Secundario apagado         | `#6d947c`               |
| `--rose`          | Acento terciario           | `#8f5c3c`               |
| `--tx-hi`         | Texto alto contraste       | `#efe9dd`               |
| `--tx`            | Texto normal               | `#cbc4ba`               |
| `--tx-lo`         | Texto bajo contraste       | `#8b8598`               |
| `--tx-faint`      | Texto deshabilitado        | `#6a657a`               |
| `--on-gold`       | Texto sobre acento         | `#0b1412`               |
| `--on-gold-dim`   | Texto sobre acento apagado | `#0b1412`               |
| `--accent-strong` | Acento fuerte (CTAs)       | `#8a8c2f`               |

### Tokens RGB (para `rgba()` dinámico)

| Token             | Valor         | Uso                             |
| ----------------- | ------------- | ------------------------------- |
| `--gold-rgb`      | `169,171,58`  | `rgba(var(--gold-rgb),.35)`     |
| `--verdigris-rgb` | `133,179,150` | `rgba(var(--verdigris-rgb),.2)` |
| `--ink950-rgb`    | `11,20,18`    | `rgba(var(--ink950-rgb),.8)`    |
| `--rose-rgb`      | `143,92,60`   | `rgba(var(--rose-rgb),.15)`     |

### Tokens de paleta (light mode — idéntico para todas)

| Token             | Valor     | Uso                 |
| ----------------- | --------- | ------------------- |
| `--ink-950`       | `#eceee9` | Fondo principal     |
| `--ink-900`       | `#f6f7f3` | Rail                |
| `--ink-850`       | `#ffffff` | Chips, inputs       |
| `--ink-800`       | `#e6e8e1` | Tooltips            |
| `--line`          | `#e0e3d9` | Bordes              |
| `--tx-hi`         | `#1e2019` | Texto alto          |
| `--tx`            | `#474a40` | Texto normal        |
| `--tx-lo`         | `#7b7e70` | Texto bajo          |
| `--tx-faint`      | `#a6a897` | Texto deshabilitado |
| `--on-gold`       | `#1a1710` | Texto sobre acento  |
| `--accent-strong` | `#8a6d12` | Acento fuerte       |

### Paletas disponibles

| ID     | Nombre | gold    | verdigris | rose    |
| ------ | ------ | ------- | --------- | ------- |
| clio-0 | Teal   | #6aae9d | #4f8290   | #9e8e91 |
| clio-1 | Earth  | #8ab0d8 | #7f7397   | #96687f |
| clio-2 | Plum   | #cca87b | #5b7d73   | #9c524e |
| clio-3 | Forest | #a9ab3a | #85b396   | #8f5c3c |
| clio-4 | Mauve  | #fbb954 | #788a87   | #b0494e |
| clio-5 | Purple | #c9a24b | #4fa393   | #c17b7b |
| clio-6 | Slate  | #96a2b3 | #7d8aa0   | #8a8f9e |
| clio-7 | Violet | #8977c9 | #fc9bd3   | #8fd6e8 |
| clio-8 | Black  | #be9585 | #5c7a66   | #966f7a |
| clio-9 | Neon   | #0098db | #ff0546   | #c33a60 |

### Persistencia

- `localStorage` key: `clio-palette`
- Valor: JSON `{ id: string, mode: 'dark'|'light' }`
- Default: `{ id: 'clio-3', mode: 'dark' }` (Forest)

---

## 2. Brand

### Archivo

- **Original**: `apps/desktop/public/refs/clio-brand.svg` (pixel art 64×64, unicolor `#fbf236`)
- **App**: `apps/desktop/public/brand.svg` (limpio, `fill="currentColor"`)

### Componente

```tsx
import { BrandIcon } from './BrandIcon';

<BrandIcon color={palette.dark.gold} size={26} />;
```

- Fetch `/brand.svg`, reemplaza `currentColor` con el color del palette
- Cachea por color para no re-fetchear
- Container: 46×46, `borderRadius: 13`, `overflow: hidden`
- SVG: `width="100%" height="100%"`, centrado con `display: grid; placeItems: center`

---

## 3. Tipografía

| Familia            | Rol                        | Pesos              |
| ------------------ | -------------------------- | ------------------ |
| **Fraunces**       | Headings, títulos de card  | 500, 600, 700      |
| **Hanken Grotesk** | Cuerpo, UI, chips, selects | 400, 500, 600, 700 |

### Tamaños de fuente

| Valor  | Uso                                      |
| ------ | ---------------------------------------- |
| `9.5`  | Badge de formato (EPUB, PDF…)            |
| `10`   | Status tag                               |
| `10.5` | Autor en cover de card                   |
| `11`   | Botón de eliminar, metadata icon         |
| `11.5` | Metadata (fechas)                        |
| `12`   | Chips pequeños, labels de filtro         |
| `12.5` | Tooltip, autor de card                   |
| `13`   | Chips, selects, subtitulo, section count |
| `13.5` | Subtitulo de topbar                      |
| `14`   | Input de búsqueda, empty hint, empty btn |
| `15`   | Título de card                           |
| `16`   | Título en cover de card                  |
| `18`   | Empty state title                        |
| `19`   | Section title                            |
| `30`   | H1 principal                             |

---

## 4. Espaciado

### Gaps

| Valor | Uso                                                          |
| ----- | ------------------------------------------------------------ |
| `2`   | Star rating entre estrellas                                  |
| `3`   | cardBody gap                                                 |
| `4`   | Nav buttons en rail                                          |
| `5`   | Status tag gap (dot + label)                                 |
| `6`   | Rail padding, cardFooter marginTop                           |
| `7`   | cardMeta gap                                                 |
| `8`   | Chips gap, filterGroup gap, nav brand gap                    |
| `9`   | Search gap                                                   |
| `11`  | Card gap (cover → body)                                      |
| `12`  | Empty state gap                                              |
| `14`  | Section accent gap, cover padding horizontal                 |
| `16`  | Cover padding top, filterRow gap entre grupos                |
| `18`  | Rail padding top, topbar gap                                 |
| `20`  | Row gap (horizontal scroll), grid gap cuando `minmax(200px)` |
| `24`  | Grid gap (collection)                                        |
| `28`  | Chips marginBottom, filterRow marginBottom                   |
| `30`  | Topbar marginBottom                                          |
| `34`  | Wrap padding top, meander marginBottom                       |

### Paddings de componentes

| Componente     | Padding               |
| -------------- | --------------------- |
| Chip (normal)  | `8px 14px`            |
| Chip (small)   | `8px 14px`            |
| Select         | `8px 14px`            |
| Tooltip        | `6px 11px`            |
| Empty button   | `10px 20px`           |
| Search         | `0 12px`              |
| Remove button  | `3px 8px`             |
| Status tag     | `4px 8px 4px 6px`     |
| Doc type badge | `4px 7px`             |
| Cover art      | `16px 14px 14px 18px` |
| Wrap (page)    | `34px 40px 60px`      |

---

## 5. Border radius

| Valor | Uso                           |
| ----- | ----------------------------- |
| `6`   | Doc type badge, remove button |
| `8`   | (reservado)                   |
| `9`   | Tooltip                       |
| `10`  | Empty button                  |
| `11`  | Search input                  |
| `13`  | Rail brand, nav buttons       |
| `20`  | Chips, selects, status tag    |

**Regla**: todo botón/chip redondo usa `borderRadius: 20`. Todo badge pequeño usa `borderRadius: 6`.

---

## 6. Componentes

### Chips (filtro)

```ts
{
  padding: '8px 14px',
  borderRadius: 20,
  fontSize: 13,
  fontWeight: 500,
  background: 'var(--ink-850)',
  border: '1px solid var(--line)',
  color: 'var(--tx-lo)',
  transition: '.18s',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

// Chip activo
{
  background: 'linear-gradient(180deg, var(--gold-bright), var(--gold))',
  color: 'var(--on-gold)',
  border: '1px solid transparent',
  fontWeight: 600,
}
```

### Select (dropdown)

```ts
{
  padding: '8px 14px',
  borderRadius: 20,
  fontSize: 13,
  background: 'var(--ink-850)',
  border: '1px solid var(--line)',
  color: 'var(--tx)',
  fontFamily: 'inherit',
  cursor: 'pointer',
  outline: 'none',
  appearance: 'auto',
}
```

### Search input

```ts
{
  display: 'flex', alignItems: 'center', gap: 9,
  background: 'var(--ink-850)',
  border: '1px solid var(--line)',
  borderRadius: 11,
  padding: '0 12px',
  height: 42,
  minWidth: 230,
  transition: '.2s',
  color: 'var(--tx-lo)',
}
```

### Tooltip

```ts
{
  position: 'absolute',
  left: 58, top: '50%', transform: 'translateY(-50%)',
  background: 'var(--ink-800)',
  color: 'var(--tx-hi)',
  border: '1px solid var(--line)',
  padding: '6px 11px',
  borderRadius: 9,
  fontSize: 12.5,
  whiteSpace: 'nowrap',
  zIndex: 40,
  boxShadow: '0 18px 50px -20px rgba(0,0,0,.7)',
  fontWeight: 500,
}
```

### Rail (sidebar)

```ts
{
  width: 76,
  background: 'linear-gradient(180deg, var(--ink-900), var(--ink-950))',
  borderRight: '1px solid var(--line)',
  padding: '18px 0',
  gap: 6,
}

// Brand: 46×46, borderRadius: 13, overflow: hidden
// Nav buttons: 48×48, borderRadius: 13
// Nav indicator: 4×22, borderRadius: '0 4px 4px 0'
// SVG icons inside nav buttons: 22×22
// Theme toggle: al final del rail, debajo de la nav
// Palette selector: debajo del theme toggle
//   - Trigger: 28×28, borderRadius: 50%, border: 1px solid var(--gold-dim)
//   - Popover: 240×140, grid 5×2, swatches 32×32
```

### Palette Selector (Popover)

```ts
// Trigger (botón circular)
{
  width: 28, height: 28, borderRadius: '50%',
  background: `var(--ink-950)`,  // color de la paleta activa
  border: '1px solid var(--gold-dim)',
  cursor: 'pointer',
  display: 'grid', placeItems: 'center',
}

// Popover
{
  position: 'absolute',
  left: 58, top: 0,
  width: 240, height: 140,
  background: 'var(--ink-800)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  padding: 16,
  boxShadow: '0 24px 64px -12px rgba(0,0,0,.6)',
  zIndex: 100,
}

// Grid de swatches
{
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 32px)',
  gridTemplateRows: 'repeat(2, 32px)',
  gap: 8,
  justifyContent: 'center',
}

// Swatch
{
  width: 32, height: 32,
  borderRadius: 8,
  background: '<ink-950 de la paleta>',
  border: '2px solid transparent',
  cursor: 'pointer',
  position: 'relative',
}

// Swatch seleccionado
{
  border: '2px solid var(--gold)',
}

// Punto dorado en centro del swatch
{
  width: 6, height: 6,
  borderRadius: '50%',
  background: '<gold de la paleta>',
  position: 'absolute',
  top: '50%', left: '50%',
  transform: 'translate(-50%,-50%)',
}
```

### Book Card

```ts
// Portada
{
  aspectRatio: '2/3',
  borderRadius: 12,
  overflow: 'hidden',
}

// Título de card
{
  fontFamily: '"Fraunces", serif',
  fontWeight: 600,
  fontSize: 15,
  lineHeight: 1.25,
  letterSpacing: '-.005em',
  color: 'var(--tx-hi)',
  WebkitLineClamp: 2,
}

// Metadata
{
  fontSize: 11.5,
  color: 'var(--tx-faint)',
  gap: 7,
}
```

### Empty states

```ts
{
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', gap: 12,
  padding: '60px 20px',
}

{
  fontFamily: '"Fraunces", serif',
  color: 'var(--tx)',
  fontWeight: 600,
  fontSize: 18,
}

{
  fontSize: 14,
  color: 'var(--tx-faint)',
  maxWidth: 340,
}

// Botón de acción
{
  padding: '10px 20px',
  background: 'linear-gradient(180deg, var(--gold-bright), var(--gold))',
  color: 'var(--on-gold)',
  border: 'none',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
}
```

---

## 7. Transiciones

| Duración | Easing                        | Uso                       |
| -------- | ----------------------------- | ------------------------- |
| `.15s`   | default                       | Remove button             |
| `.18s`   | default                       | Chips, filtros            |
| `.2s`    | default                       | Search input              |
| `.22s`   | `cubic-bezier(.22,.61,.36,1)` | Nav buttons, cards, cover |

---

## 8. Layout

| Elemento   | Valor                                            |
| ---------- | ------------------------------------------------ |
| Rail width | `76px` fijo                                      |
| Wrap max   | `1180px`, centrado con `margin: 0 auto`          |
| Grid cards | `repeat(auto-fill, minmax(190px, 1fr))`          |
| Row scroll | `grid-auto-flow: column, grid-auto-columns: 200` |
| Row gap    | `20px`                                           |
| Grid gap   | `24px`                                           |

---

## 9. Reglas estrictas

1. **Nunca crear un nuevo tamaño de chip.** Todos los chips usan `padding: '8px 14px'`, `borderRadius: 20`, `fontSize: 13`.

2. **Nunca crear un nuevo border radius** sin verificar la tabla en §5.

3. **Los selects heredan el mismo padding y borderRadius que los chips.**

4. **Los labels de filtro** usan `fontSize: 13`, `color: 'var(--tx-lo)'`, `fontWeight: 500`.

5. **Los gaps entre grupos de filtros** son `16px`. Los gaps dentro de un grupo son `8px`.

6. **El margin inferior** de la sección de chips y la sección de filtros es `28px`.

7. **No agregar comentarios** en el código a menos que el usuario lo pida.

8. **Si un estilo nuevo no está documentado aquí**, consultarlo antes de implementarlo.

9. **Usar CSS vars** (`var(--gold)`, `var(--tx-lo)`, etc.) en vez de colores inline. Los colores hardcoded solo en temas/definiciones.

10. **Brand**: Usar `<BrandIcon color={palette.dark.gold} />` en vez de SVG inline.

---

## 10. Referencias de diseño

La referencia visual completa del proyecto se encuentra en:

```
apps/desktop/public/refs/clio-0.html  (Teal)
apps/desktop/public/refs/clio-1.html  (Earth)
apps/desktop/public/refs/clio-2.html  (Plum)
apps/desktop/public/refs/clio-3.html  (Forest)
apps/desktop/public/refs/clio-4.html  (Mauve)
apps/desktop/public/refs/clio-5.html  (Purple)
apps/desktop/public/refs/clio-6.html  (Slate)
apps/desktop/public/refs/clio-7.html  (Violet)
apps/desktop/public/refs/clio-8.html  (Black)
apps/desktop/public/refs/clio-9.html  (Neon)
```

Cada archivo contiene la implementación HTML/CSS/JS de una paleta específica.

---

## 11. Modelo de dominio

```ts
type BookFormat = 'epub' | 'pdf' | 'cbz' | 'md';
type ReadingStatus = 'unread' | 'opened' | 'reading';

interface Book {
  id: BookId;
  title: string;
  author?: string;
  format: BookFormat;
  uri: string;
  fileHash?: string;
  addedAt: number;
  lastOpenedAt?: number;
  readingStatus?: ReadingStatus;
  language?: string;
  status: 'available' | 'missing';
}
```

---

## 12. Controles del lector (reader.html / reader.css)

El lector tiene su propio set de controles; usar los mismos tokens (`var(--gold)`,
`var(--tx)`, etc.) y no colores inline.

### Paneles

| Panel        | Id / botón                | Contenido                                        |
| ------------ | ------------------------- | ------------------------------------------------ |
| Información  | `r-info`                  | Metadata, portada, rank                          |
| Índice (TOC) | `r-toc`                   | Capítulos del libro                              |
| Búsqueda     | `r-search`                | Búsqueda en el contenido                         |
| Notas        | `r-notes` / `panel-notes` | Cita seleccionada, textarea, lista de notas      |
| Ajustes      | `r-set`                   | Tema, tipografía, tamaño, interlineado, márgenes |

### Márgenes (slider)

- Rango **8 – 120 px**, paso **2**, default **48**
- Constantes: `MIN_READER_MARGIN` / `MAX_READER_MARGIN` / `DEFAULT_READER_MARGIN` en `packages/domain`
- Persiste en `ReaderPreferences.margin` (SQLite lo guarda como texto numérico; los valores legacy `compact`/`comfortable`/`wide` migran a 16/48/96)

### Modo Zen

- Botón `r-zen` + salida `zen-exit`
- Oculta cintillos y pone `max-width: none` en la página para ocupar todo el ancho

### Widget de selección (resaltado/nota)

- `sel-widget` con paleta `sel-colors`, `sel-note` y `sel-delete`
- 6 colores fijos (`packages/annotations/src/highlight-colors.ts`):
  `#facc15` (amarillo), `#4ade80` (verde), `#38bdf8` (azul), `#f472b6` (rosa), `#fb923c` (naranja), `#c084fc` (morado)
- Solo disponible en formatos refluibles (EPUB/MD); en PDF/CBZ se oculta
