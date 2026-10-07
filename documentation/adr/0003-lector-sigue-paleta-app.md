# ADR-0003: Chrome del lector sigue la paleta; el contenido conserva su superficie de lectura

| Campo                             | Valor                                                |
| --------------------------------- | ---------------------------------------------------- |
| **Nombre**                        | Separación chrome/superficie de lectura en el lector |
| **Autor**                         | Clio Reader                                          |
| **Fecha de creación**             | 22 de septiembre de 2026                             |
| **Fecha de última actualización** | 22 de septiembre de 2026                             |
| **Estado**                        | Aceptado para la implementación                      |
| **Versión del documento**         | 1.0.0                                                |

## Contexto

Al abrir un EPUB, el lector mostraba una única superficie: el `data-theme` se derivaba de `ReaderPreferences.theme` (default `light` → `paper`) y `reader.css` aplicaba el mismo fondo (`--read-bg`) a los cintillos, al drawer y al contenido. En modo oscuro de la app, la paleta inyectada al webview no alcanzaba el reader, que seguía en pergamino/sepia.

El requisito real es doble:

- El **chrome del lector** (cintillo superior `r-bar`, cintillo inferior `r-foot` y drawer) debe seguir la paleta y el modo de la app (`paletteId` + modo `dark`/`light` de `themes.ts`).
- El **render del libro** (la superficie de lectura `.page`) debe conservar sus colores establecidos (`--read-bg`/`--read-tx`, pergamino por defecto), independientemente del modo de la app.

## Decisión

1. **Tokens separados en `reader.css`**. `.reader` define tokens de chrome resueltos desde la paleta inyectada (`--chrome-bg`, `--chrome-fg`, `--chrome-fg-lo`, `--chrome-line`, `--chrome-hover`, `--chrome-field`) que el webview recibe vía `__applyPalette`. Los cintillos, drawer, TOC, notas, busqueda y ajustes usan solo estos tokens. `--read-bg`/`--read-tx`/`--read-tx-lo` quedan reservados a la superficie de lectura.
2. **`data-theme` solo rige la superficie de lectura**. El tema inicial se toma de `ReaderPreferences.theme` (`light`→`paper`, `dark`→`night`, `sepia`→`sepia`), no del modo de la app. Los swatches del drawer (`paper`/`sepia`/`night`) siguen siendo el override efímero de la sesión y solo afectan al contenido.
3. **El contenido EPUB resuelve colores desde la superficie**. `generateThemeCss` de `reader-epub` emite `--reader-bg: var(--read-bg, …)`, `--reader-fg: var(--read-tx, …)`, `--reader-accent: var(--gold, …)` con fallback literal por tema nombrado. Solo `theme: 'custom'` emite los colores explícitos del usuario. Así, el contenido sigue teniendo los colores establecidos al entrar y cambia en vivo si el usuario cambia el swatch.
4. **El CSS de tema del contenido se hace `append`** sobre el HTML del capítulo, para que el tema del lector gane sobre los `<style>` de algunos EPUB (p. ej. `body { background: #fff }`).
5. **Tokens para el modo claro**: `LIGHT_DEFAULTS` en `themes.ts` completa los tokens `read-*`, acentos y `on-gold` que antes dependían de los defaults del `reader.css`.

## Consecuencias

- En modo oscuro de la app, el lector muestra cintillos, drawer y toolbars oscuros siguiendo la paleta, mientras el contenido mantiene su pergamino/superficie de lectura; en modo claro, los cintillos usan el alabastro de la app y el contenido conserva los mismos colores.
- Cambiar el swatch del drawer actualiza la superficie del libro en vivo (las reglas del contenido resuelven `--read-bg` dentro de `.reader`), sin re-render ni regenerar el CSS.
- `generateThemeCss` sigue siendo determinista y probable de forma aislada: los fallback se emiten como literales dentro de `var()`.
- El `data-theme` ya no depende del modo de la app: una preferencia guardada `dark`/`sepia` se respeta al entrar.

## Pruebas

Unitarias de `reader-epub` (`epub-themes.test.ts`) siguen cubriendo `generateThemeCss`, `generateFontCss`, `generateMarginCss` y `generateReaderStyle`. Verificación manual en desktop: (1) app en modo oscuro → abrir EPUB → cintillos/drawer oscuros y contenido pergamino; (2) app en modo claro → cintillos alabastro y contenido pergamino; (3) swatches del drawer (papel/sepia/noche) alteran solo el contenido; (4) preferencia de lectura guardada (p. ej. sepia) al entrar muestra esa superficie con el chrome de la app.

## Alternativas consideradas

- **Derivar `data-theme` del modo de la app** (`dark` → `night`): descartado, oscurecía también el documento y contradecía la exigencia de conservar los colores establecidos del render.
- **Reutilizar `--read-*` para todo el lector**: descartado, era la causa de que cintillos y contenido compartieran apariencia y no siguieran la paleta de la app.
- **Colores absolutos por tema en el contenido**: descartado, rompía la coherencia con la paleta y la superficie de lectura.
