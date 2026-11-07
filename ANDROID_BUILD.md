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

### The Gradle wrapper is incomplete

`android/gradlew` was previously a simulation script: it ignored its
arguments, printed "APK build complete!", and wrote placeholder text
files named `*.apk`. It has been replaced with a guard script that
fails loudly instead.

`android/gradle/wrapper/gradle-wrapper.properties` pins Gradle 8.2,
but there is no `gradle-wrapper.jar` and no real `gradlew` in the repo.
Per the Gradle docs, a wrapper is not downloaded — it is generated
with `gradle wrapper` on a machine with Gradle installed:

```
cd android && gradle wrapper --gradle-version 8.2
```

Then re-run `npm run build:apk`. Until a real wrapper (and the Android
SDK) is present, `npm run build:apk` will fail at the `./gradlew` step
instead of silently producing a fake APK. That failure is intentional.

## vite.config.ts

The audit claimed no `vite.config.*` existed. That was wrong:
`vite.config.ts` exists at the repo root and already registers
`@vitejs/plugin-react` and `@tailwindcss/vite`. No change was made to
it in this branch.
