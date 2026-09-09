# 11 — Paletas de Color para Personalización

## Overview

Permitir al usuario elegir entre paletas de color predefinidas (o crear una propia) para personalizar la apariencia de la app. Cada paleta redefine los tokens CSS existentes manteniendo la coherencia visual y el contraste.

## Problema actual

El sistema actual solo ofrece dark/light con una paleta fija (tinta nocturna + oro viejo + verdigris). No hay forma de personalizar los acentos ni las superficies sin modificar el CSS manualmente.

## Propuesta

### Tokens a personalizar

Cada paleta redefine estos tokens CSS (extraídos de `library.css`):

| Token | Rol | Grupo |
|-------|-----|-------|
| `--ink-950` | Fondo principal | Superficie |
| `--ink-900` | Rail / sidebar | Superficie |
| `--ink-850` | Chips, inputs, badges | Superficie |
| `--ink-800` | Tooltips, bordes internos | Superficie |
| `--ink-700` | Superficie intermedia | Superficie |
| `--ink-600` | Superficie ligera | Superficie |
| `--line` | Bordes | Superficie |
| `--ink` | Acento oscuro (bordes sutiles) | Acento |
| `--moss` | Acento primario (chips activos) | Acento |
| `--wine` | Acento terciario (notas) | Acento |
| `--dust` | Acento fuerte (CTAs) | Acento |
| `--caramel` | Hover, gradientes | Acento |
| `--sand` | Texto sutil, metadata | Acento |
| `--verdigris` | Acento secundario | Acento |
| `--verdigris-dim` | Acento secundario apagado | Acento |
| `--rose` | Acento terciario | Acento |
| `--tx-hi` | Texto alto contraste | Texto |
| `--tx` | Texto normal | Texto |
| `--tx-lo` | Texto bajo contraste | Texto |
| `--tx-faint` | Texto deshabilitado | Texto |

### Highlights dark mode (paleta Nocturna)

Colores de highlight basados en la paleta custom para tema oscuro. Reemplazan los `rgba(201,162,75,.xx)` actuales. No alteran los fondos de superficie.

| Token | Hex | Rol | Uso actual reemplazado |
|-------|-----|-----|------------------------|
| `--ink` | `#3b392a` | Gold muy oscuro (fondo sutil) | — |
| `--moss` | `#655d4a` | Gold apagado medio | — |
| `--wine` | `#6f4143` | Rose oscuro (notas, bookmarks) | — |
| `--dust` | `#a46a66` | Rosa apagado (mark en reader) | `rgba(201,162,75,.4)` |
| `--caramel` | `#a4825d` | Caramelo (::selection) | `rgba(201,162,75,.35)` |
| `--sand` | `#d6baa5` | Arena (highlights de búsqueda) | — |

**Mapeo a CSS actual:**

```css
/* Actual */
::selection { background: rgba(201,162,75,.35); }
.page mark  { background: rgba(201,162,75,.4); }

/* Propuesto */
::selection { background: var(--caramel); }  /* #a4825d */
.page mark  { background: var(--dust); }     /* #a46a66 */
```

**Regla de contraste:** `--caramel` y `--sand` sobre `var(--tx-hi)` (`#efe9dd`) deben pasar WCAG AA (4.5:1).

### Reader themes (tokens adicionales)

| Token | Rol |
|-------|-----|
| `--read-bg` | Fondo de lectura |
| `--read-tx` | Texto de lectura |
| `--read-tx-lo` | Texto secundario de lectura |

### Estructura de una paleta

```ts
interface ColorPalette {
  id: string;
  name: string;
  /** Valores para dark mode */
  dark: PaletteTokens;
  /** Valores para light mode */
  light: PaletteTokens;
}

interface PaletteTokens {
  surfaces: {
    ink950: string;  // --ink-950
    ink900: string;  // --ink-900
    ink850: string;  // --ink-850
    ink800: string;  // --ink-800
    ink700: string;  // --ink-700
    ink600: string;  // --ink-600
    line: string;    // --line
  };
  accents: {
    ink: string;
    moss: string;
    wine: string;
    dust: string;
    caramel: string;
    sand: string;
    verdigris: string;
    verdigrisDim: string;
    rose: string;
  };
  text: {
    hi: string;
    base: string;
    lo: string;
    faint: string;
  };
  reader?: {
    readBg: string;
    readTx: string;
    readTxLo: string;
  };
}
```

### Paletas predefinidas

| Paleta | Identidad | `ink` | `moss` | `wine` | `dust` | `caramel` | `sand` | `verdigris` | `verdigris-dim` | `rose` |
|--------|-----------|-------|--------|--------|--------|-----------|--------|-------------|-----------------|--------|
| **Nocturna** (default) | Tinta + tierra | `#3b392a` | `#655d4a` | `#6f4143` | `#a46a66` | `#a4825d` | `#d6baa5` | `#4fa393` | `#2f6d61` | `#c17b7b` |
| **Bosque** | Verde profundo | `#2e3a28` | `#4a5e3e` | `#5e3a3a` | `#8a6e5a` | `#7a8a5a` | `#c4cfa5` | `#6b9e7a` | `#3d6e4a` | `#c4917a` |
| **Océano** | Azul marino | `#2a3040` | `#3e5060` | `#4a3050` | `#7a6080` | `#5a7a8a` | `#a0c0d0` | `#81b4d8` | `#4a7da3` | `#b87aad` |
| **Lavanda** | Púrpura suave | `#302a3a` | `#504060` | `#5a3858` | `#8a6888` | `#7060a0` | `#b8a8d0` | `#9b8ec4` | `#6a5e93` | `#c48b8b` |
| **Carmesí** | Rojo oscuro | `#3a2828` | `#5a3838` | `#6a3030` | `#9a6060` | `#8a5050` | `#d0a0a0` | `#a63d40` | `#6e2829` | `#d4a07a` |

**Mapeo de tokens:**

| Token | Rol |
|-------|-----|
| `--ink` | Acento oscuro, bordes sutiles |
| `--moss` | Acento primario, bg de chips activos |
| `--wine` | Acento terciario, notas |
| `--dust` | Acento fuerte, CTAs |
| `--caramel` | Hover, gradientes |
| `--sand` | Texto sutil, metadata |

**Uso en CSS actual:**

```css
/* Actual */
::selection { background: rgba(201,162,75,.35); }    /* gold */
.page mark  { background: rgba(201,162,75,.4); }     /* gold */
background: linear-gradient(180deg, var(--gold-bright), var(--gold));

/* Propuesto */
::selection { background: var(--caramel); }            /* #a4825d */
.page mark  { background: var(--dust); }               /* #a46a66 */
background: linear-gradient(180deg, var(--caramel), var(--moss));
```

### Reader themes (tokens adicionales)

### Mecanismo de aplicación

1. **Persistencia**: Guardar `paletteId` en `localStorage` (`clio-palette`)
2. **Aplicación**: Al cargar la app, resolver la paleta + tema (dark/light) y setear CSS variables en `:root` via un `<style>` injection o `document.documentElement.style.setProperty()`
3. **Toggle**: El existing theme toggle (dark/light) se mantiene. La paleta es una dimensión independiente
4. **Reader**: Los reader themes heredan la paleta del shell; los swatches de paper/sepia/night se ajustan automáticamente

### UI de selección

- **Ubicación**: Nuevo panel "Paleta" dentro del drawer de ajustes del reader, o sección en el sidebar de settings
- **Componente**: Grid de swatches (como los actuales `.sw` de reader themes), cada uno mostrando 3-4 colores representativos
- **Preview**: Al hacer clic, la paleta se aplica en tiempo real (live preview)
- **Reset**: Botón "Restablecer" para volver a la paleta default (Nocturna)

### Cambios necesarios

| Archivo | Cambio |
|---------|--------|
| `apps/desktop/src/App.tsx` | Leer `paletteId` de localStorage, resolver CSS variables, inyectar en DOM |
| `apps/desktop/src/library.css` | Mover valores hardcodeados de `:root` a ser aplicados dinámicamente |
| `apps/desktop/src/reader.css` | Mover valores de `:root` a ser aplicados dinámicamente |
| `apps/desktop/src/components/LibraryView.tsx` | Agregar selector de paleta en el rail o settings |
| `apps/desktop/src/reader-entry.ts` | Aplicar paleta del reader theme al webview |
| Nuevo: `apps/desktop/src/palettes.ts` | Definición de paletas predefinidas |
| Nuevo: `apps/desktop/src/hooks/usePalette.ts` | Hook para resolver y aplicar paleta activa |

### Restricciones de accesibilidad

- Todas las paletas deben mantener contraste mínimo WCAG AA (4.5:1 para texto normal, 3:1 para texto grande)
- El selector de paleta debe ser navegable por teclado
- Los swatches deben tener `aria-label` descriptivo
- Mantener `prefers-reduced-motion` para transiciones de cambio de paleta

### Fases de implementación

**Fase 1 — Paletas predefinidas**
- Definir `palettes.ts` con las 5 paletas
- Crear `usePalette` hook
- Mover tokens de CSS a inyección dinámica
- Selector de paleta en UI

**Fase 2 — Paleta custom**
- Color picker para cada token
- Validación de contraste en tiempo real
- Guardar paleta custom en localStorage
- Import/export de paletas (JSON)

**Fase 3 — Sync con reader**
- Aplicar paleta activa al webview del reader
- Ajustar swatches de paper/sepia/night según paleta
- Persistir preferencia por libro (opcional)
