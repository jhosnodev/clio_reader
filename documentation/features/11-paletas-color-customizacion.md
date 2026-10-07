# 11 — Paletas de Color para Personalización

## Overview

Permitir al usuario elegir entre 10 paletas de color predefinidas para personalizar la apariencia de la app. Cada paleta redefine los tokens CSS existentes manteniendo la coherencia visual y el contraste. El light mode es idéntico para todas las paletas (alabastro).

## Problema anterior

El sistema solo ofrecía dark/light con una paleta fija (tinta + oro viejo + verdigris). No había forma de personalizar los acentos ni las superficies sin modificar el CSS manualmente.

## Solución implementada

### Arquitectura

| Archivo                          | Rol                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/themes.ts`                  | Definición de las 10 paletas, `applyTheme()`, `PALETTES`, `getPalette()`, helpers de localStorage |
| `src/App.tsx`                    | State `{paletteId, mode}`, pasa `palette` y `paletteId` a LibraryView                             |
| `src/library.css`                | Variables CSS con `rgba(var(--xxx-rgb),.N)` para colores dinámicos                                |
| `src/reader.css`                 | Mismo tratamiento que library.css                                                                 |
| `src/components/LibraryView.tsx` | Palette selector en Rail, brand SVG usa palette                                                   |
| `src/components/BrandIcon.tsx`   | Componente de brand unicolor con `currentColor`                                                   |
| `src/components/ReaderView.tsx`  | Colores inline → CSS vars                                                                         |

### Paletas implementadas

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

### Estructura de una paleta

```ts
interface ThemePalette {
  id: string;
  name: string;
  dark: {
    // Superficies
    'ink-950': string;
    'ink-900': string;
    'ink-850': string;
    'ink-800': string;
    'ink-700': string;
    'ink-600': string;
    'ink-500': string;
    line: string;
    // Acentos
    gold: string;
    'gold-bright': string;
    'gold-dim': string;
    verdigris: string;
    'verdigris-dim': string;
    rose: string;
    // Texto
    'tx-hi': string;
    tx: string;
    'tx-lo': string;
    'tx-faint': string;
    // Acciones
    'on-gold': string;
    'on-gold-dim': string;
    'accent-strong': string;
    // RGB decompositions (para rgba())
    'gold-rgb': string;
    'verdigris-rgb': string;
    'ink950-rgb': string;
    'rose-rgb': string;
  };
  light: Record<string, string>; // Idéntico para todas las paletas
}
```

### Mecanismo de aplicación

1. **Persistencia**: `localStorage` key `clio-palette` con JSON `{ id: string, mode: 'dark'|'light' }`
2. **Aplicación**: `applyTheme()` inyecta CSS variables como inline style en `.app`
3. **Toggle**: El toggle dark/light y el selector de paleta son dimensiones independientes
4. **Brand**: `BrandIcon` fetch `/brand.svg`, reemplaza `currentColor` con `palette.dark.gold`

### UI de selección

- **Ubicación**: Popover en el Rail (sidebar), debajo del toggle dark/light
- **Trigger**: Botón circular con color `ink-950` de la paleta activa + borde `gold-dim`
- **Contenido**: Grid 5×2 de swatches (32×32px cada uno)
- **Swatch**: Fondo `ink-950` de la paleta + punto dorado `gold` en centro
- **Seleccionado**: Borde `gold`
- **Tooltip**: Nombre de la paleta al hacer hover

### Restricciones de accesibilidad

- Todas las paletas mantienen contraste mínimo WCAG AA (4.5:1)
- El selector de paleta es navegable por teclado
- Los swatches tienen `aria-label` descriptivo
- Se respeta `prefers-reduced-motion`

### Fases completadas

**Fase 1 — Paletas predefinidas** ✅

- `themes.ts` con las 10 paletas
- CSS vars inyectadas dinámicamente
- Selector de paleta en UI

**Fase 2 — Brand unicolor** ✅

- `clio-brand.svg` con `fill="currentColor"`
- `BrandIcon` component con cache por color

**Fase 3 — Sync con reader** ✅

- ReaderView.tsx usa CSS vars en vez de colores inline
