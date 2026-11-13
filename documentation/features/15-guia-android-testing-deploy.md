# Guía: probar la app Android en la PC y desplegar a dispositivos reales

| Campo                       | Valor                                                |
| --------------------------- | ---------------------------------------------------- |
| **Nombre**                  | clio_reader — Guía de testing y deploy Android       |
| **Fecha de creación**       | 14 de octubre de 2026                                |
| **Estado**                  | Guía operativa (Fase 9)                              |
| **Versión del documento**   | 1.0.0                                                |
| **Spec relacionada**        | `documentation/features/14-lector-mobile-android.md` |
| **Método de build elegido** | Local (Android Studio + `expo run:android`)          |

## 1. Objetivo

Este documento explica, de principio a fin:

1. **Preparar la PC** (Linux) con Node, JDK y el Android SDK.
2. **Probar la app en un emulador** que corre en la misma PC (Paso 1, detallado).
3. **Desplegar a un dispositivo físico** para pruebas reales (development build).
4. **Generar un APK de release** para repartir a testers que no tienen Metro.

La app mobile vive en `apps/mobile` (Expo + React Native) y reutiliza el bundle
del lector de escritorio dentro de un `react-native-webview`. Ver la spec 14 para
la arquitectura host ↔ reader.

> **Resumen del flujo:** instalar toolchain → `pnpm install` → `pnpm build` →
> `build:reader` → arrancar emulador → `expo run:android` → probar → (si aplica)
> release APK → instalar en el teléfono.

## 2. Prerequisitos (instalación desde cero)

Estado detectado en esta PC: **no hay Java, `adb` ni `ANDROID_HOME`**. Sigue los
pasos en orden; no saltes al emulador sin completar el SDK.

### 2.1 Node.js y pnpm

Ya presentes (Node 22+, pnpm 12.16.1). Verifica:

```bash
node --version     # >= 22
pnpm --version     # 12.16.1
```

Desde la raíz del repo instala dependencias:

```bash
pnpm install
```

### 2.2 JDK 17 (obligatorio)

React Native 0.76 / Expo SDK 52 compilan con **JDK 17**. Un JDK 21 o 11 puede
fallar con Gradle/AGP.

**Ubuntu / Debian:**

```bash
sudo apt update
sudo apt install -y openjdk-17-jdk
```

**Fedora:**

```bash
sudo dnf install -y java-17-openjdk-devel
```

Verifica:

```bash
java -version          # debe reportar 17.x
echo $JAVA_HOME
```

Si `JAVA_HOME` está vacío, defínelo (ajusta la ruta a tu instalación):

```bash
# en ~/.bashrc
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"
```

### 2.3 Android Studio y Android SDK

Instala **Android Studio** (trae el SDK Manager, el AVD Manager y el emulador):

- Descarga: https://developer.android.com/studio
- Alternativa por paquete:

  ```bash
  # Ubuntu (snap)
  sudo snap install android-studio --classic
  ```

Al abrir Android Studio por primera vez, el asistente descarga el SDK en
`~/Android/Sdk` (ruta por defecto en Linux). Si no lo hace, ve a
**Settings → Languages & Frameworks → Android SDK**.

**Componentes que debes instalar** (SDK Manager → pestaña _SDK Platforms_ y
_SDK Tools_). Versiones que requiere Expo SDK 52 / RN 0.76:

| Componente                                | Versión / paquete       | Para qué                   |
| ----------------------------------------- | ----------------------- | -------------------------- |
| SDK Platform                              | **Android 15 (API 35)** | `compileSdk` / `targetSdk` |
| Build-Tools                               | **35.0.0**              | empaquetado del APK        |
| Platform-Tools                            | última                  | `adb` (instalar en device) |
| Emulator                                  | última                  | emulador del Paso 1        |
| Android SDK Command-line Tools            | última (latest)         | `sdkmanager`, `avdmanager` |
| NDK (Side by side)                        | **26.1.10909125**       | módulos nativos (RN)       |
| CMake                                     | **3.22.1**              | build nativo, worker PDF   |
| Android SDK Platform-Tools (rev.)         | última                  | `adb`                      |
| Intel/AMD x86 Emulator Accelerator (HAXM) | solo si no hay KVM      | aceleración (antiguo)      |

Selecciona **"Show Package Details"** en SDK Tools para poder fijar Build-Tools
35.0.0 y NDK 26.1.10909125 si no aparecen por defecto.

### 2.4 Variables de entorno

Añade a `~/.bashrc` (asumiendo SDK en `~/Android/Sdk`):

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_HOME/emulator"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin"
```

Recarga y verifica:

```bash
source ~/.bashrc
echo $ANDROID_HOME
adb --version
sdkmanager --version
emulator -version | head -1
```

### 2.5 Aceptar licencias del SDK

Gradle aborta el build si hay licencias sin aceptar:

```bash
sdkmanager --licenses
# responde "y" a todas
```

### 2.6 Aceleración del emulador (KVM en Linux)

El emulador x86 corre mucho más rápido con KVM. Compruébalo:

```bash
ls -l /dev/kvm        # debe existir
groups | grep kvm     # tu usuario debe pertenecer al grupo kvm
```

Si `/dev/kvm` no existe o no tienes permiso:

```bash
sudo apt install -y qemu-kvm
sudo usermod -aG kvm "$USER"   # cierra sesión y vuelve a entrar
```

Sin KVM el emulador arranca en modo software (muy lento) o no arranca.

### 2.7 Instalar herramientas CLI de Expo

No hace falta instalación global; `npx expo` usa la versión local del proyecto.
Para verificar la salud del proyecto móvil usa `expo-doctor` vía npx (no está en
`node_modules/.bin` del paquete):

```bash
cd apps/mobile && npx expo-doctor
```

No hay CI de Android en este repo: no existe workflow de APK. Los builds de
Android son locales (esta guía). Si se necesita un APK reproducible habría que
añadir un workflow tipo `apk-build.yml`.

## 3. Preparar el bundle del reader (obligatorio)

`apps/mobile/assets/reader.html` está en `.gitignore` y se **genera** desde el
proyecto de escritorio. Sin este paso la app arranca pero el lector no carga.

```bash
# 1. Compila los packages del monorepo (dist de reader-*, domain, etc.)
pnpm build

# 2. Genera el bundle HTML autocontenido del reader
pnpm --filter @clio-reader/mobile build:reader
#   -> equivale a: vite build --config vite.reader.mobile.config.ts
```

Verifica que exista `apps/mobile/assets/reader.html`. **Regénéralo cada vez que
cambie código del reader de escritorio** (`apps/desktop/src/reader/**`,
`packages/reader-*`).

## 4. Paso 1 — Probar en el emulador (PC)

Objetivo: validar la app completa sin necesidad de un teléfono. Es la fase más
detallada porque concentra la configuración y el diagnóstico.

### 4.1 Crear un AVD (Android Virtual Device)

**Opción A — Android Studio (recomendada):**

1. Abre **Device Manager** (icono de teléfono en la barra derecha).
2. **Create Device** → elige un perfil, p. ej. **Pixel 7**.
3. Selecciona una imagen de sistema: **API 35 (Android 15)**, ABI `x86_64`
   (o `arm64-v8a` si tu CPU es ARM).
4. Nombre, p. ej. `Pixel7_API35`, y **Finish**.

**Opción B — línea de comandos:**

```bash
sdkmanager "system-images;android-35;google_apis;x86_64"
avdmanager create avd -n Pixel7_API35 \
  -k "system-images;android-35;google_apis;x86_64" -d pixel_7
```

### 4.2 Arrancar el emulador

Desde Android Studio: botón ▶ en Device Manager.
Desde terminal:

```bash
emulator -avd Pixel7_API35 &
# espera a que el home de Android aparezca (1–3 min la primera vez)
```

Verifica que `adb` lo ve:

```bash
adb devices
# List of devices attached
# emulator-5554   device
```

### 4.3 Elegir entre Expo Go y development build

| Enfoque               | Qué es                                   | Cuándo usarlo                           |
| --------------------- | ---------------------------------------- | --------------------------------------- |
| **Expo Go**           | App genérica de Expo (ya trae WebView)   | Smoke test rápido, sin compilar nativo  |
| **Development build** | Tu APK de debug con código nativo propio | **Ruta recomendada** para este proyecto |

Expo Go para SDK 52 solo soporta la **New Architecture** y no aplica tu
`app.json`/plugins nativos. Como este proyecto depende de `react-native-webview`
y carga un asset `reader.html` desde el bundle, el **development build** es la
ruta fiable y la que usarás también para release.

### 4.4 Generar y ejecutar el development build

El primer `run:android` genera el directorio nativo `android/` (Continuous
Native Generation) e instala la app en el emulador encendido:

```bash
# arranca Metro + compila el APK debug + instala + abre la app
pnpm --filter @clio-reader/mobile exec expo run:android
```

Equivalente alías del repo (solo arranca Metro, requiere dev build ya instalado):

```bash
pnpm --filter @clio-reader/mobile android   # expo start --android
```

La primera compilación Gradle tarda varios minutos. Al terminar, la app
"Clio Reader" se abre en el emulador y Metro queda sirviendo en `:8081`.

Notas:

- `android/` es generado; no lo edites a mano salvo necesidad (usa
  `app.json`/plugins).
- Si cambias dependencias nativas, recompila con `expo run:android`; si solo
  cambias JS/TS, basta recargar (tecla `r` en Metro).

### 4.5 Qué probar en el emulador

Sigue el checklist de la sección 7. Como mínimo:

1. Importar un EPUB, un PDF, un CBZ y un MD (arrastra el archivo al emulador, o
   usa el proveedor de archivos del sistema).
2. Abrir cada uno y navegar; comprobar el render por formato.
3. Cerrar el libro y reabrir: el progreso (locator + percent) debe restaurarse.
4. Eliminar un libro: el archivo copiado en `clio-reader/books/<id>-<name>` debe
   borrarse.
5. Cambiar el rank de un libro.
6. Enviar la app a segundo plano y volver: la biblioteca/progreso se recargan
   (`useAppLifecycle`).

### 4.6 Diagnóstico y logs

| Fuente                    | Cómo verlo                                                        |
| ------------------------- | ----------------------------------------------------------------- |
| Logs de Metro / JS        | La terminal donde corre `expo run:android`                        |
| Sentinelas del reader     | `__clio_back__`, `__clio_rank__…`, `__clio_prefs__…` en esos logs |
| Logs nativos del emulador | `adb logcat` (filtra: `adb logcat ReactNativeJS:V *:S`)           |
| Estado del device         | `adb devices`, `adb shell`                                        |
| Recargar app              | tecla `r` en Metro, o `adb shell input keyevent 82` (menú dev)    |

### 4.7 Problemas frecuentes del Paso 1

| Síntoma                                     | Causa probable / solución                                        |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `adb: command not found`                    | Falta `platform-tools` en `PATH` (§2.4).                         |
| `emulator: command not found`               | Falta `emulator` en `PATH` o el paquete Emulator en SDK Manager. |
| `SDK location not found` al compilar        | `ANDROID_HOME` no exportado en la shell del build.               |
| Gradle falla por JDK                        | `JAVA_HOME` apunta a 17 erróneo; `java -version` debe ser 17.    |
| `Failed to install... licenses`             | Ejecuta `sdkmanager --licenses` y acepta todo.                   |
| Emulador extremadamente lento               | KVM no disponible (§2.6); revisa `/dev/kvm`.                     |
| El lector no carga (pantalla en blanco)     | Falta `assets/reader.html`; ejecuta §3 y reconstruye.            |
| `Unable to resolve module @clio-reader/...` | Faltó `pnpm build` (§3) o reiniciar Metro con `--clear`.         |
| Metro no conecta desde el device            | `adb reverse tcp:8081 tcp:8081`.                                 |

## 5. Paso 2 — Dispositivo físico (development build)

1. **Activa opciones de desarrollador** en el teléfono: Ajustes → Acerca del
   teléfono → toca 7 veces "Número de compilación".
2. **Depuración USB**: Ajustes → Opciones de desarrollador → _Depuración USB_.
3. Conecta por USB y autoriza la huella RSA que aparece en el teléfono.
4. Verifica:

   ```bash
   adb devices
   # List of devices attached
   # XXXXXXXX   device          <-- "unauthorized" = acepta el diálogo
   ```

5. Compila e instala en el dispositivo conectado:

   ```bash
   pnpm --filter @clio-reader/mobile exec expo run:android --device
   ```

6. Si Metro no conecta por red, reenvía el puerto por USB:

   ```bash
   adb reverse tcp:8081 tcp:8081
   ```

Prueba los mismos casos del checklist (§7), prestando atención a los riesgos
pendientes de la spec 14 (worker de PDF desde `file://`, memoria con archivos
grandes, `allowFileAccess` en Android 10+).

## 6. Paso 3 — APK de release para pruebas reales

Para entregar la app a testers que **no** tienen Metro ni cable USB, genera un
APK que incluya el bundle JS.

### Opción A — `expo run:android --variant release`

```bash
pnpm --filter @clio-reader/mobile exec expo run:android --variant release
```

Esto compila el bundle JS dentro del APK, lo instala en el device/emulador
conectado y no necesita Metro.

### Opción B — Gradle directo (mismo resultado, APK reutilizable)

```bash
pnpm build
pnpm --filter @clio-reader/mobile build:reader
cd apps/mobile/android
./gradlew assembleRelease
```

El APK queda en:

```text
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Instálalo por USB o compártelo para sideload:

```bash
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

### Firma

El proyecto generado por Expo usa por defecto la **keystore de debug** para el
release, suficiente para sideload en pruebas. Para publicar en Play Store
necesitarás una keystore de release propia y configuración en
`android/app/build.gradle` (fuera del alcance de esta guía).

> Recuerda regenerar `reader.html` (§3) **antes** de cada build de release, o el
> lector quedará con la versión antigua embebida.

## 7. Checklist de pruebas

- [ ] La app abre sin crash en emulador API 35.
- [ ] Importar EPUB / PDF / CBZ / MD (document picker).
- [ ] Abrir y navegar cada formato; el render es correcto.
- [ ] Selección de texto / búsqueda (según capacidades del formato).
- [ ] Progreso guardado tras cerrar y reabrir.
- [ ] Preferencias globales (tema, escala) persistidas.
- [ ] Rank guardado (`__clio_rank__`).
- [ ] Eliminar libro borra el archivo copiado.
- [ ] Transición a segundo plano y vuelta recarga estado.
- [ ] PDF: worker desde `file://` no bloqueado (riesgo 1).
- [ ] PDF grande: memoria aceptable (riesgo 2).
- [ ] JS inyectado antes de `type="module"` (riesgo 3).
- [ ] Carga `file://` en Android 10+ (riesgo 4).

## 8. Comandos rápidos

> Nota: en este documento "Paso" se refiere a los pasos de esta guía, no a las
> fases del plan de implementación (Fase 9 = Android, Etapa 3 del roadmap).

```bash
# Preparación
pnpm install
pnpm build
pnpm --filter @clio-reader/mobile build:reader

# Emulador (Paso 1)
emulator -avd Pixel7_API35 &
adb devices
pnpm --filter @clio-reader/mobile exec expo run:android

# Dispositivo físico (Paso 2)
adb devices
pnpm --filter @clio-reader/mobile exec expo run:android --device
adb reverse tcp:8081 tcp:8081

# Release APK (Paso 3)
pnpm --filter @clio-reader/mobile exec expo run:android --variant release
# o
cd apps/mobile/android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk

# Diagnóstico
adb logcat ReactNativeJS:V *:S
pnpm --filter @clio-reader/mobile exec expo start --clear
```

## 9. Referencias

- Spec del lector mobile: `documentation/features/14-lector-mobile-android.md`
- Entorno de desarrollo: `documentation/06-desarrollo-local.md`
- Convenciones y scripts: `AGENTS.md` §13 y §19
- Expo SDK 52 changelog: https://expo.dev/changelog/2024-11-12-sdk-52
- Android Studio / SDK: https://developer.android.com/studio
