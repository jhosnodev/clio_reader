# Clio Reader — Style Guide

Referencia de diseño para el equipo. Toda UI nueva debe seguir estos tokens y
patrones exactos. No inventar valores; si algo no está documentado, preguntar
antes de implementar.

---

## 1. Paleta de colores

### Superficies (tema oscuro por defecto)

| Token         | Valor       | Uso                                      |
|---------------|-------------|------------------------------------------|
| `bg`          | `#100f18`   | Fondo principal de la app                |
| `surface-1`   | `#16141f`   | Rail (sidebar), gradiente inferior       |
| `surface-2`   | `#1c1a28`   | Chips inactivos, inputs, selects, badges |
| `surface-3`   | `#232032`   | Tooltips, bordes de cards internos       |
| `border`      | `#332f47`   | Bordes de todos los elementos            |

### Superficies (tema claro — alabastro / piedra)

| Token         | Valor       | Uso                                      |
|---------------|-------------|------------------------------------------|
| `bg`          | `#eceee9`   | Fondo principal de la app                |
| `surface-1`   | `#f6f7f3`   | Rail (sidebar)                           |
| `surface-2`   | `#ffffff`   | Chips inactivos, inputs, selects, badges |
| `surface-3`   | `#e6e8e1`   | Tooltips, bordes de cards internos       |
| `border`      | `#e0e3d9`   | Bordes de todos los elementos            |

### Acentos

| Token         | Valores                          | Uso                                 |
|---------------|----------------------------------|-------------------------------------|
| `earth`       | `#3b392a` / `#655d4a` / `#a46a66` | Botones activos, gradientes, indicadores |
| `verdigris`   | `#4fa393`                        | Acentos secundarios, progreso       |
| `verdigris-l` | `#6fd0bf`                        | Gradiente de barra de progreso      |

### Texto (tema oscuro)

| Token      | Valor     | Uso                                         |
|------------|-----------|---------------------------------------------|
| `text-hi`  | `#efe9dd` | Títulos principales, texto en gradientes     |
| `text-n`   | `#cbc4ba` | Cuerpo de texto, valores de selects          |
| `text-lo`  | `#8b8598` | Labels secundarios, metadata, chips inactivos |
| `text-f`   | `#6a657a` | Hints vacíos, counts, texto deshabilitado    |

### Texto (tema claro)

| Token      | Valor     | Uso                                         |
|------------|-----------|---------------------------------------------|
| `text-hi`  | `#1e2019` | Títulos principales, texto en gradientes     |
| `text-n`   | `#474a40` | Cuerpo de texto, valores de selects          |
| `text-lo`  | `#7b7e70` | Labels secundarios, metadata, chips inactivos |
| `text-f`   | `#a6a897` | Hints vacíos, counts, texto deshabilitado    |

---

## 2. Temas (dark / light)

La app soporta dos temas controlados por `data-app-theme` en el elemento `.app`.
El toggle se encuentra en el **Rail (sidebar)** como botón sol/luna.

### Variables CSS

```css
/* Tema oscuro (default) */
.app {
  --ink-950: #100f18;   /* bg */
  --ink-900: #16141f;   /* surface-1 (rail) */
  --ink-850: #1c1a28;   /* surface-2 */
  --ink-800: #232032;   /* surface-3 */
  --line: #332f47;       /* border */
  --tx-hi: #efe9dd;     /* text-hi */
  --tx: #cbc4ba;        /* text-n */
  --tx-lo: #8b8598;     /* text-lo */
  --tx-faint: #6a657a;  /* text-f */
  --on-moss: #1a1710;   /* texto sobre acento */
  --accent-strong: #e6c874;
}

/* Tema claro */
.app[data-app-theme="light"] {
  --ink-950: #eceee9;   /* bg */
  --ink-900: #f6f7f3;   /* surface-1 (rail) */
  --ink-850: #ffffff;   /* surface-2 */
  --ink-800: #e6e8e1;   /* surface-3 */
  --line: #e0e3d9;       /* border */
  --tx-hi: #1e2019;     /* text-hi */
  --tx: #474a40;        /* text-n */
  --tx-lo: #7b7e70;     /* text-lo */
  --tx-faint: #a6a897;  /* text-f */
  --on-gold: #1a1710;   /* texto sobre oro (constante) */
  --accent-strong: #8a6d12;
}
```

### Persistencia

- El tema se persiste en `localStorage` con la key `clio-app-theme`.
- Valores válidos: `'dark'` | `'light'`.
- Si no hay valor almacenado, se usa `prefers-color-scheme` del sistema.

### Comportamiento del toggle

- **Rail**: Botón sol/luna al final del sidebar (debajo de la nav).
- **Iconos**: Sol visible en tema oscuro, luna visible en tema claro.
- **Color del icono**: `var(--ink)` en tema oscuro, `var(--moss)` en tema claro.
- **Hover**: Cambia a `var(--dust)` / `var(--wine)` respectivamente.
- **Tooltip**: Muestra "Tema claro" o "Tema oscuro" según el estado actual.

---

## 2. Tipografía

| Familia          | Rol                          | Pesos            |
|------------------|------------------------------|------------------|
| **Fraunces**     | Headings, títulos de card    | 500, 600, 700    |
| **Hanken Grotesk** | Cuerpo, UI, chips, selects | 400, 500, 600, 700 |

### Tamaños de fuente

| Valor  | Uso                                        |
|--------|--------------------------------------------|
| `9.5`  | Badge de formato (EPUB, PDF…)              |
| `10`   | Status tag                                 |
| `10.5` | Autor en cover de card                     |
| `11`   | Botón de eliminar, metadata icon           |
| `11.5` | Metadata (fechas)                          |
| `12`   | Chips pequeños, labels de filtro           |
| `12.5` | Tooltip, autor de card                     |
| `13`   | Chips, selects, subtitulo, section count   |
| `13.5` | Subtitulo de topbar                        |
| `14`   | Input de búsqueda, empty hint, empty btn   |
| `15`   | Título de card                             |
| `16`   | Título en cover de card                    |
| `18`   | Empty state title                          |
| `19`   | Section title                              |
| `30`   | H1 principal                               |

---

## 3. Espaciado

### Gaps

| Valor | Uso                                              |
|-------|--------------------------------------------------|
| `2`   | Star rating entre estrellas                      |
| `3`   | cardBody gap                                     |
| `4`   | Nav buttons en rail                              |
| `5`   | Status tag gap (dot + label)                     |
| `6`   | Rail padding, cardFooter marginTop               |
| `7`   | cardMeta gap                                     |
| `8`   | Chips gap, filterGroup gap, nav brand gap        |
| `9`   | Search gap                                       |
| `11`  | Card gap (cover → body)                          |
| `12`  | Empty state gap                                  |
| `14`  | Section accent gap, cover padding horizontal     |
| `16`  | Cover padding top, filterRow gap entre grupos    |
| `18`  | Rail padding top, topbar gap                     |
| `20`  | Row gap (horizontal scroll), grid gap cuando `minmax(200px)` |
| `24`  | Grid gap (collection)                            |
| `28`  | Chips marginBottom, filterRow marginBottom       |
| `30`  | Topbar marginBottom                              |
| `34`  | Wrap padding top, meander marginBottom           |

### Paddings de componentes

| Componente        | Padding                          |
|-------------------|----------------------------------|
| Chip (normal)     | `8px 14px`                       |
| Chip (small)      | `8px 14px` (mismo que normal)    |
| Select            | `8px 14px`                       |
| Tooltip           | `6px 11px`                       |
| Empty button      | `10px 20px`                      |
| Search            | `0 12px`                         |
| Remove button     | `3px 8px`                        |
| Status tag        | `4px 8px 4px 6px`                |
| Doc type badge    | `4px 7px`                        |
| Cover art         | `16px 14px 14px 18px`            |
| Wrap (page)       | `34px 40px 60px`                 |

---

## 4. Border radius

| Valor  | Uso                                              |
|--------|--------------------------------------------------|
| `6`    | Doc type badge, remove button                    |
| `8`    | (reservado para uso futuro)                      |
| `9`    | Tooltip                                          |
| `10`   | Empty button                                     |
| `11`   | Search input                                     |
| `13`   | Rail brand, nav buttons                          |
| `20`   | Chips (todos los tamaños), selects, status tag   |

**Regla**: todo botón/chip redondo usa `borderRadius: 20`. Todo badge
pequeño usa `borderRadius: 6`.

---

## 5. Componentes

### Chips (filtro)

```ts
// Chip estándar (tamaño normal)
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
  background: 'linear-gradient(180deg, var(--dust), var(--moss))',
  color: 'var(--on-moss)',
  border: '1px solid transparent',
  fontWeight: 600,
}
```

**IMPORTANTE**: Chips de formato y chips de estado usan las **mismas**
dimensiones y estilos. No crear variaciones de tamaño.

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
// Contenedor
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

// Input
{
  background: 'none', border: 'none', outline: 'none',
  color: 'var(--tx-hi)', fontSize: 14,
  width: '100%', fontFamily: 'inherit',
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

// Brand: 46×46, borderRadius: 13
// Nav buttons: 48×48, borderRadius: 13
// Nav indicator: 4×22, borderRadius: '0 4px 4px 0'
// SVG icons inside nav buttons: 22×22
// Theme toggle: positionado al final del rail, debajo de la nav
//   - Mismas dimensiones que nav buttons (48×48, borderRadius: 13)
//   - Color: var(--ink) en dark, var(--moss) en light
//   - Hover: var(--dust) en dark, var(--wine) en light
//   - Icono sol visible en dark, icono luna visible en light
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
// Contenedor
{
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', gap: 12,
  padding: '60px 20px',   // Collection
  // padding: '80px 20px', // Home, Bookmarks
}

// Título
{
  fontFamily: '"Fraunces", serif',
  color: 'var(--tx)',
  fontWeight: 600,
  fontSize: 18,
}

// Hint
{
  fontSize: 14,
  color: 'var(--tx-faint)',
  maxWidth: 340,
}

// Botón de acción
{
  padding: '10px 20px',
  background: 'linear-gradient(180deg, var(--dust), var(--moss))',
  color: 'var(--on-moss)',
  border: 'none',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
}
```

---

## 6. Transiciones

| Duración | Easing                                          | Uso                        |
|----------|------------------------------------------------|----------------------------|
| `.15s`   | default                                         | Remove button              |
| `.18s`   | default                                         | Chips, filtros             |
| `.2s`    | default                                         | Search input               |
| `.22s`   | `cubic-bezier(.22,.61,.36,1)`                  | Nav buttons, cards, cover  |

---

## 7. Layout

| Elemento     | Valor                                     |
|--------------|-------------------------------------------|
| Rail width   | `76px` fijo                               |
| Wrap max     | `1180px`, centrado con `margin: 0 auto`  |
| Grid cards   | `repeat(auto-fill, minmax(190px, 1fr))`  |
| Row scroll   | `grid-auto-flow: column, grid-auto-columns: 200` |
| Row gap      | `20px`                                    |
| Grid gap     | `24px`                                    |

---

## 8. Reglas estrictas

1. **Nunca crear un nuevo tamaño de chip.** Todos los chips usan
   `padding: '8px 14px'`, `borderRadius: 20`, `fontSize: 13`.

2. **Nunca crear un nuevo border radius** sin verificar la tabla en §4.

3. **Los selects heredan el mismo padding y borderRadius que los chips.**

4. **Los labels de filtro** usan `fontSize: 13`, `color: 'var(--tx-lo)'`,
   `fontWeight: 500`.

5. **Los gaps entre grupos de filtros** son `16px`. Los gaps dentro de un
   grupo son `8px`.

6. **El margin inferior** de la sección de chips y la sección de filtros
   es `28px`.

7. **No agregar comentarios** en el código a menos que el usuario lo pida.

8. **Si un estilo nuevo no está documentado aquí**, consultarlo antes de
   implementarlo.

---

## 9. Referencias de diseño

La referencia visual completa del proyecto se encuentra en:

```
apps/desktop/public/refs/clio.html
```

Este archivo contiene la implementación HTML/CSS/JS de la UI de Clio, incluyendo:
- Paleta completa con variables CSS
- Estructura de layout (rail + stage + views)
- Tarjetas de libro (cover, status, progress)
- Lector (reader) con transiciones, toolbar, drawer, zen mode
- Componentes UI (chips, search, tooltip, toast, empty states)
- Comportamiento de navegación entre vistas

**Regla**: Toda UI nueva debe replicar fielmente los estilos de esta referencia.
Consultar este archivo antes de implementar cualquier componente nuevo.

---

## 10. Modelo de dominio

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
