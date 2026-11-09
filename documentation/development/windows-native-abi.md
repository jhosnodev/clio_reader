# Módulos nativos y ABI de Electron (better-sqlite3)

Guía de diagnóstico y prevención para cuando la app de escritorio **instala pero no arranca** en Windows.

## Síntoma

1. El instalador `Clio Reader Setup X.Y.Z.exe` corre y termina sin errores.
2. Al iniciar la app, **no aparece la ventana**: el icono puede aparecer unos segundos en la barra de tareas y desaparecer.
3. En Linux el mismo código funciona sin problemas.

La causa más frecuente es un **desajuste de ABI** en el binario nativo de `better-sqlite3`.

## Qué es el ABI

Electron empaqueta su propio runtime de Node. Cada runtime se identifica con un número de versión de módulo nativo (`NODE_MODULE_VERSION`):

| Runtime                   | Versión | `NODE_MODULE_VERSION` |
| ------------------------- | ------- | --------------------- |
| Electron (este proyecto)  | 28.3.3  | **119**               |
| Node.js 22 (el de CI/dev) | 22.x    | **127**               |

Un `.node` compilado para 127 **no se puede cargar** en un runtime 119, y viceversa:

```text
Error: The module '.../better_sqlite3.node' was compiled against a different
Node.js version using NODE_MODULE_VERSION 127. This version of Node.js
requires NODE_MODULE_VERSION 119.
```

Como `apps/desktop/electron/main.ts` importa `better-sqlite3` en el top-level, el proceso principal muere **antes** de crear la ventana: la app "no arranca".

## Diagnóstico paso a paso

### 1. Descargar el artefacto del CI

```bash
gh run list --workflow=windows-build.yml --limit 5
gh run download <RUN_ID> -n clio-reader-windows
```

El artefacto contiene `Clio Reader Setup 0.1.0.exe`.

### 2. Extraer el payload del instalador NSIS

```bash
mkdir /tmp/ci-inspect && cd /tmp/ci-inspect
7z x '/ruta/al/Clio Reader Setup 0.1.0.exe' '$PLUGINSDIR/app-64.7z'
7z x './$PLUGINSDIR/app-64.7z'
```

Queda la app desempaquetada con `resources/app.asar` y `resources/app.asar.unpacked/`.

### 3. Comprobar el ABI de los binarios nativos

```bash
for f in $(find resources/app.asar.unpacked -name '*.node'); do
  echo -n "$f -> "
  strings -a "$f" | grep -oE 'node_register_module_v[0-9]+' | sort -u
done
```

Interpretación:

- `node_register_module_v119` → correcto para Electron 28.3.3.
- `node_register_module_v127` → compilado para Node 22. **La app no arrancará.**

Complementos útiles:

```bash
# Plataforma del binario: "4d5a" (MZ) = Windows, "7f454c46" = ELF (Linux)
head -c2 better_sqlite3.node | xxd -p

# Respaldos de build que no deberían ir empaquetados
find resources -name '*.host-backup'
```

### 4. Calcular el ABI esperado

```bash
node -e "
const { createRequire } = require('module');
const { join } = require('path');
const r = createRequire(join(process.cwd(), 'package.json'));
const nodeAbi = require(createRequire(r.resolve('electron-builder/package.json')).resolve('node-abi'));
console.log('electron:', nodeAbi.getAbi('28.3.3', 'electron'));
console.log('node:', nodeAbi.getAbi(process.versions.node, 'node'));
"
```

## Causa raíz (caso real, 2026-11-07)

El instalador publicado traía los 4 `.node` con ABI **127**. La cadena fue:

1. `pnpm install` ejecuta el install script de `better-sqlite3`
   (`prebuild-install || node-gyp rebuild`) con el Node 22 del runner → binario **ABI 127**.
2. El `postinstall` (`electron-builder install-app-deps`) intenta recompilarlo para Electron,
   pero en Windows con el layout aislado de pnpm falla con `⨯ cannot find prebuild-install`.
3. `electron-builder.yml` tenía `npmRebuild: true`, que usa la misma vía y falla igual.
4. `verify-win-build.mjs` solo comprobaba que el `.node` fuera PE de Windows (`MZ`) — lo era —
   y que el `.exe` pesara >20 MB. **No verificaba el ABI**, así que el CI quedaba en verde.

Reproducción del fallo (para confirmar la hipótesis antes de tocar código):

```bash
# Descargar el prebuild de Node 22 (ABI 127) en un dir temporal
cd /tmp/bsq && cp .../better-sqlite3/package.json .
node .../prebuild-install/bin.js

# Sustituirlo en un build que sí arrancaba y lanzar la app
cp build/Release/better_sqlite3.node <linux-unpacked>/resources/app.asar.unpacked/.../
./clio-reader
# → NODE_MODULE_VERSION mismatch, la app no carga
```

## Corrección aplicada

| Archivo                          | Cambio                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/native-abi.mjs`         | Nuevo. Lee `node_register_module_vNNN` de un `.node` y calcula el ABI esperado con `node-abi`.                                   |
| `scripts/ensure-native.mjs`      | Nuevo. **Postinstall** determinista: descarga el prebuild de Electron para la plataforma host y valida el ABI.                   |
| `package.json`                   | `postinstall`: `electron-builder install-app-deps` → `node scripts/ensure-native.mjs`.                                           |
| `electron-builder.yml`           | `npmRebuild: false` (se elimina la vía que fallaba silenciosamente).                                                             |
| `scripts/build-win.mjs`          | `prepareWindowsNative()` y `npmRebuild=false` en **todos** los hosts, no solo fuera de Windows.                                  |
| `scripts/verify-win-build.mjs`   | Falla si algún `.node` no tiene el ABI de Electron, o si hay respaldos `.host-backup` empaquetados.                              |
| `scripts/verify-linux-build.mjs` | Mismo chequeo de ABI para el paquete de Linux.                                                                                   |
| `scripts/win-native.mjs`         | Respaldos en un directorio temporal (antes iban dentro del paquete: ~2 MB de basura); fetch de prebuild genérico por plataforma. |

Principio: **el binario nativo se prepara explícitamente para el ABI de Electron y el build falla si no coincide.** Ya no se depende de que electron-builder lo recompile correctamente.

## Verificación

```bash
# Validación completa del repo (format + check + lint + tests)
pnpm validate

# Build de Windows con verificación de ABI incluida
pnpm --filter @clio-reader/desktop build:win
# → [verify-win] OK: 4 módulos nativos Windows (ABI 119), app.asar presente.

# Build de Linux
pnpm --filter @clio-reader/desktop build:linux
# → [verify-linux] OK: 4 módulos nativos ELF (ABI 119), app.asar, 1 AppImage y 1 deb válidos.

# Smoke test en Linux (arranca y carga la biblioteca)
cd apps/desktop/release/linux-unpacked
xvfb-run -a ./clio-reader --no-sandbox
```

Verificación manual del artefacto: repite los pasos de _Diagnóstico paso a paso_ 2–3 y confirma `node_register_module_v119` en los 4 `.node`.

## Cómo regenerar el instalador

`windows-build.yml` solo corre con un tag `v*` o manualmente. Para lanzarlo desde una rama:

```bash
git push origin <rama>

gh workflow run windows-build.yml --ref <rama>
gh run watch <RUN_ID> --exit-status --interval 15
gh run download <RUN_ID> -n clio-reader-windows
```

La ejecución tarda ~2-3 minutos. Después, valida el ABI del artefacto descargado antes de distribuirlo.

## Referencia rápida

| Comando                                                        | Uso                                              |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `strings -a X.node \| grep -oE 'node_register_module_v[0-9]+'` | ABI real de un binario nativo                    |
| `node scripts/ensure-native.mjs`                               | (re)instalar el binario de Electron para el host |
| `node scripts/verify-win-build.mjs`                            | Verificar un build de Windows existente          |
| `node scripts/verify-linux-build.mjs`                          | Verificar un build de Linux existente            |
| `gh workflow run windows-build.yml --ref <rama>`               | Generar instalador en CI                         |

## Véase también

- [Setup en Windows y troubleshooting](./windows-setup.md)
- [Guía de desarrollo local](./README.md)
- [Guía de la base de datos](../diseño-de-DB.md)
