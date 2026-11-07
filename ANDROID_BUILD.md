# Android build notes (audit fix, 2026-11-06)

## This app is NOT a Capacitor app

`capacitor.config.json` was removed in `fix/audit-critical` because it was
misleading:

- `package.json` contains no `@capacitor/*` packages.
- `android/app/build.gradle` and `android/settings.gradle` contain no
  Capacitor dependencies.
- `MainActivity.java` is a plain `AppCompatActivity` with a `WebView`,
  not a Capacitor `BridgeActivity`.

Adding Capacitor properly would mean installing `@capacitor/core`,
`@capacitor/cli`, and `@capacitor/android`, migrating `MainActivity` to
a Capacitor bridge, and running `npx cap sync`. That is a larger
migration, not a bug fix, so it was not done here. Do not re-add
`capacitor.config.json` on its own — it does not make Capacitor present.

## Building a real APK

`npm run build:apk` now runs:

```
npm run build
cp -r dist/. android/app/src/main/assets/public/
cd android && ./gradlew assembleDebug
```

The APK, once built, is in
`android/app/build/outputs/apk/debug/`.

### The Gradle wrapper is now real, except for one file

`android/gradlew` and `android/gradlew.bat` are the official Gradle 8.2
wrapper scripts and `android/gradle/wrapper/gradle-wrapper.properties`
pins `gradle-8.2-bin.zip`. The wrapper was verified locally:
`./gradlew --version` prints Gradle 8.2 after the distribution is
present (see below).

One file is still missing from the repo: `gradle/wrapper/gradle-wrapper.jar`.
It is a binary and could not be pushed with the text-only tools used
here. Generate it on any machine with Gradle 8.2 installed:

```
cd android && gradle wrapper --gradle-version 8.2
```

That regenerates the jar (and rewrites the scripts/properties to the
same content already committed). Alternatively, extract the jar from a
Gradle 8.2 distribution:

```
unzip -p <gradle-8.2-install>/lib/plugins/gradle-wrapper-8.2.jar gradle-wrapper.jar \
  > android/gradle/wrapper/gradle-wrapper.jar
```

Until the jar is in place, `./gradlew` will fail with
"Could not find or load main class org.gradle.wrapper.GradleWrapperMain".

### Verified 2026-11-07 (branch fix/build-verification)

- `npm ci` now works: `package.json` bumped `esbuild` `^0.25.0` →
  `^0.28.0` (vite 8.3.5 requires esbuild `^0.27.0 || ^0.28.0`; the old
  pin made every clean install fail with ERESOLVE). `package-lock.json`
  updated to esbuild 0.28.2.
- `npx tsc --noEmit`: exit 0. `npm run build`: exit 0
  (dist: 1.36 MB JS, 97 kB CSS).
- `npm run build:apk`: vite build passes, but `./gradlew assembleDebug`
  could not run in the verification sandbox — every Gradle invocation
  there fails with "Could not receive a message from the daemon", even
  for a trivial empty Gradle project, while the daemon itself starts
  and listens on 127.0.0.1. That is an environment limitation, not a
  project error. On a normal machine with a JDK 17 + Android SDK
  (compileSdk/targetSdk 34, build-tools 34.0.0), run:
  `npm run build:apk` — the APK lands in
  `android/app/build/outputs/apk/debug/`.

## vite.config.ts

The audit claimed no `vite.config.*` existed. That was wrong:
`vite.config.ts` exists at the repo root and already registers
`@vitejs/plugin-react` and `@tailwindcss/vite`. One real fix was made
in `fix/build-verification`: `path.resolve(__dirname, '.')` →
`path.resolve(import.meta.dirname, '.')`, removing Vite 8's warning
that `__dirname` is unsupported by the native config loader. Verified
with `npx tsc --noEmit` (exit 0) and `npm run build` (exit 0).
