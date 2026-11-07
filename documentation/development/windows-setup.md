# Setup en Windows — App de escritorio

Guía paso a paso para configurar el entorno de desarrollo en Windows y ejecutar la app de Clio Reader.

## 1. Instalar Node.js

1. Descarga Node.js 22+ desde [nodejs.org](https://nodejs.org/)
2. Ejecuta el instalador (usa las opciones por defecto)
3. Verifica la instalación:

```bash
node --version   # Debe mostrar v22.x.x o superior
npm --version
```

## 2. Instalar pnpm

```bash
npm install -g pnpm@10.15.1
```

Verifica:

```bash
pnpm --version   # Debe mostrar 10.15.1
```

## 3. Instalar Git

1. Descarga Git desde [git-scm.com](https://git-scm.com/)
2. Usa las opciones por defecto del instalador
3. Verifica:

```bash
git --version
```

## 4. Clonar e instalar el proyecto

```bash
# Clonar
git clone <url-del-repo>
cd clio_reader

# Instalar todas las dependencias del monorepo
pnpm install
```

> **Nota:** El monorepo usa workspaces. `pnpm install` instala dependencias de todos los paquetes (`packages/*`) y las apps (`apps/*`).

## 5. Ejecutar la app en desarrollo

```bash
pnpm --filter @clio-reader/desktop dev
```

Esto:

1. Compila los paquetes del dominio (`packages/*`)
2. Inicia el servidor de Vite con hot-reload
3. Abre la ventana de Electron

La app se recarga automáticamente al guardar cambios.

## 6. Ejecutar tests

```bash
# Todos los tests del monorepo
pnpm test

# Tests solo del desktop
pnpm --filter @clio-reader/desktop test

# Validación completa (recomendado antes de un PR)
pnpm validate
```

## 7. Build para Windows

### Instalador NSIS (.exe)

```bash
pnpm --filter @clio-reader/desktop build:win
```

Genera un instalador en `apps/desktop/release/Clio Reader Setup 0.1.0.exe`.

### Versión portable (sin instalar)

```bash
pnpm --filter @clio-reader/desktop build:win:portable
```

Genera una carpeta `win-unpacked/` con el ejecutable portátil.

### Abrir el build existente

Ya hay un build compilado en el repositorio:

```bash
start "apps/desktop/release/Clio Reader Setup 0.1.0.exe"
```

## Troubleshooting

### Error: "Electron failed to install correctly"

Este es el error más común. Ocurre porque pnpm 10+ bloquea los scripts de instalación de dependencias por defecto (medida de seguridad).

**Solución:** Verifica que `pnpm-workspace.yaml` tenga esta configuración:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'

onlyBuiltDependencies:
  - electron
  - esbuild
```

Luego reinstala:

```bash
pnpm install --force
```

### Error: "pnpm: command not found"

Asegúrate de que pnpm está en tu PATH:

```bash
npm install -g pnpm@10.15.1
```

Si persiste, reinicia la terminal o el sistema.

### Error: "Node.js version incompatible"

El proyecto requiere Node.js 22+. Verifica tu versión:

```bash
node --version
```

Si necesitas cambiar de versión, usa [nvm-windows](https://github.com/coreybutler/nvm-windows):

```bash
nvm install 22
nvm use 22
```

### Error de TypeScript durante el build

Ejecuta el typecheck para ver el error específico:

```bash
pnpm --filter @clio-reader/desktop check
```

Corrige los errores de tipos y vuelve a intentar.

### La app no abre / pantalla negra

1. Verifica que no haya otro proceso de Electron usando el mismo puerto
2. Revisa la consola de errores en la terminal donde ejecutaste `pnpm dev`
3. Intenta limpiar y reconstruir:

```bash
pnpm --filter @clio-reader/desktop build
pnpm --filter @clio-reader/desktop dev
```

### Error en tests: "Cannot find module"

Asegúrate de que los paquetes del dominio están compilados:

```bash
pnpm build
pnpm test
```

### El build de Windows falla

electron-builder necesita herramientas de Windows. Asegúrate de tener:

- Windows 10/11 actualizado
- Espacio en disco suficiente (~2GB para el build)
- Sin antivirus bloqueando la compilación

### El .exe no abre / hace clic y no ocurre nada

Causa más común: el instalador se compiló desde Linux con el binario nativo de
`better-sqlite3` de Linux (ELF). El proceso principal de Electron falla al
cargar SQLite y se cierra antes de mostrar la ventana.

Soluciones:

1. Compila en Windows con `pnpm --filter @clio-reader/desktop build:win`, o
2. Usa el workflow de GitHub Actions `windows-build.yml`, o
3. En Linux, ejecuta `pnpm --filter @clio-reader/desktop build:win`: prepara
   los binarios `win32` y genera un zip portable (el instalador NSIS requiere
   `wine`).

Verifica cualquier build con:

```bash
pnpm --filter @clio-reader/desktop exec node scripts/verify-win-build.mjs
```

También revisa el tamaño del `.exe` del instalador: si pesa menos de ~20 MB,
no contiene la app (build interrumpido). Un build completo es de decenas de MB.

## Estructura del proyecto

```
clio_reader/
├── apps/
│   └── desktop/          ← App de Electron (Windows)
│       ├── electron/     ← Proceso principal de Electron
│       ├── src/          ← React UI + bridges de plataforma
│       ├── release/      ← Builds compilados (.exe)
│       └── package.json
├── packages/             ← Paquetes compartidos (domain, readers, storage, etc.)
├── documentation/        ← Documentación del proyecto
└── development/          ← Esta carpeta (guías de desarrollo)
```

## Comandos rápidos

| Acción                 | Comando                                                 |
| ---------------------- | ------------------------------------------------------- |
| Instalar dependencias  | `pnpm install`                                          |
| Ejecutar en desarrollo | `pnpm --filter @clio-reader/desktop dev`                |
| Build Windows          | `pnpm --filter @clio-reader/desktop build:win`          |
| Build portable         | `pnpm --filter @clio-reader/desktop build:win:portable` |
| Tests                  | `pnpm test`                                             |
| Validación completa    | `pnpm validate`                                         |
| Typecheck              | `pnpm check`                                            |
| Lint                   | `pnpm lint`                                             |
| Formatear código       | `pnpm format`                                           |
