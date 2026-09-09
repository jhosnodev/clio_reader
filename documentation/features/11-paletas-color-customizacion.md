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
| `--gold` | Acento primario | Acento |
| `--gold-bright` | Acento primario brillante | Acento |
| `--gold-dim` | Acento primario apagado | Acento |
| `--verdigris` | Acento secundario | Acento |
| `--verdigris-dim` | Acento secundario apagado | Acento |
| `--rose` | Acento terciario | Acento |
| `--tx-hi` | Texto alto contraste | Texto |
| `--tx` | Texto normal | Texto |
| `--tx-lo` | Texto bajo contraste | Texto |
| `--tx-faint` | Texto deshabilitado | Texto |
| `--accent-strong` | Acento fuerte (varía por tema) | Acento |

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
    gold: string;
    goldBright: string;
    goldDim: string;
    verdigris: string;
    verdigrisDim: string;
    rose: string;
    accentStrong: string;
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

| Paleta | Identidad | `gold` | `gold-bright` | `gold-dim` | `verdigris` | `verdigris-dim` | `rose` | `accent-strong` |
|--------|-----------|--------|---------------|------------|-------------|-----------------|--------|-----------------|
| **Nocturna** (default) | Tinta + oro viejo | `#c9a24b` | `#e6c874` | `#8a7434` | `#4fa393` | `#2f6d61` | `#c17b7b` | `#e6c874` |
| **Bosque** | Verde profundo + ámbar | `#d4a24e` | `#e8c06a` | `#9a7a3a` | `#6b9e7a` | `#3d6e4a` | `#c4917a` | `#e8c06a` |
| **Océano** | Azul marino + coral | `#e07a5f` | `#f09a82` | `#a85a44` | `#81b4d8` | `#4a7da3` | `#b87aad` | `#f09a82` |
| **Lavanda** | Púrpura suave + dorado | `#c9a24b` | `#e6c874` | `#8a7434` | `#9b8ec4` | `#6a5e93` | `#c48b8b` | `#e6c874` |
| **Carmesí** | Rojo oscuro + crema | `#e8d5b7` | `#f2e4cc` | `#b09a7a` | `#a63d40` | `#6e2829` | `#d4a07a` | `#f2e4cc` |

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
