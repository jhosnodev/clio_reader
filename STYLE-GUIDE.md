# Clio Reader — Style Guide

Referencia de diseño para el equipo. Toda UI nueva debe seguir estos tokens y
patrones exactos. No inventar valores; si algo no está documentado, preguntar
antes de implementar.

---

## 1. Paleta de colores

### Superficies

| Token         | Valor       | Uso                                      |
|---------------|-------------|------------------------------------------|
| `bg`          | `#100f18`   | Fondo principal de la app                |
| `surface-1`   | `#16141f`   | Rail (sidebar), gradiente inferior       |
| `surface-2`   | `#1c1a28`   | Chips inactivos, inputs, selects, badges |
| `surface-3`   | `#232032`   | Tooltips, bordes de cards internos       |
| `border`      | `#332f47`   | Bordes de todos los elementos            |

### Acentos

| Token         | Valores                          | Uso                                 |
|---------------|----------------------------------|-------------------------------------|
| `gold`        | `#c9a24b` / `#e6c874` / `#8a7434` | Botones activos, gradientes, indicadores |
| `verdigris`   | `#4fa393`                        | Acentos secundarios, progreso       |
| `verdigris-l` | `#6fd0bf`                        | Gradiente de barra de progreso      |

### Texto

| Token      | Valor     | Uso                                         |
|------------|-----------|---------------------------------------------|
| `text-hi`  | `#efe9dd` | Títulos principales, texto en gradientes     |
| `text-n`   | `#cbc4ba` | Cuerpo de texto, valores de selects          |
| `text-lo`  | `#8b8598` | Labels secundarios, metadata, chips inactivos |
| `text-f`   | `#6a657a` | Hints vacíos, counts, texto deshabilitado    |

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
  background: '#1c1a28',
  border: '1px solid #332f47',
  color: '#8b8598',
  transition: '.18s',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

// Chip activo
{
  background: 'linear-gradient(180deg, #e6c874, #c9a24b)',
  color: '#100f18',
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
  background: '#1c1a28',
  border: '1px solid #332f47',
  color: '#cbc4ba',
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
  background: '#1c1a28',
  border: '1px solid #332f47',
  borderRadius: 11,
  padding: '0 12px',
  height: 42,
  minWidth: 230,
  transition: '.2s',
  color: '#8b8598',
}

// Input
{
  background: 'none', border: 'none', outline: 'none',
  color: '#efe9dd', fontSize: 14,
  width: '100%', fontFamily: 'inherit',
}
```

### Tooltip

```ts
{
  position: 'absolute',
  left: 58, top: '50%', transform: 'translateY(-50%)',
  background: '#232032',
  color: '#efe9dd',
  border: '1px solid #332f47',
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
  background: 'linear-gradient(180deg, #16141f, #100f18)',
  borderRight: '1px solid #332f47',
  padding: '18px 0',
  gap: 6,
}

// Brand: 46×46, borderRadius: 13
// Nav buttons: 48×48, borderRadius: 13
// Nav indicator: 4×22, borderRadius: '0 4px 4px 0'
// SVG icons inside nav buttons: 22×22
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
  WebkitLineClamp: 2,
}

// Metadata
{
  fontSize: 11.5,
  color: '#6a657a',
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
  color: '#cbc4ba',
  fontWeight: 600,
  fontSize: 18,
}

// Hint
{
  fontSize: 14,
  color: '#6a657a',
  maxWidth: 340,
}

// Botón de acción
{
  padding: '10px 20px',
  background: 'linear-gradient(180deg, #e6c874, #c9a24b)',
  color: '#100f18',
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

4. **Los labels de filtro** usan `fontSize: 13`, `color: '#8b8598'`,
   `fontWeight: 500`.

5. **Los gaps entre grupos de filtros** son `16px`. Los gaps dentro de un
   grupo son `8px`.

6. **El margin inferior** de la sección de chips y la sección de filtros
   es `28px`.

7. **No agregar comentarios** en el código a menos que el usuario lo pida.

8. **Si un estilo nuevo no está documentado aquí**, consultarlo antes de
   implementarlo.

---

## 9. Modelo de dominio

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
