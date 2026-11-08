// The localStorage keys this app owns. A "reset" must only clear these —
// previously both reset paths called localStorage.clear(), which also
// wiped anything else stored under the app's WebView origin (including
// keys other features or a future version might own). Scoped removal
// keeps a reset from being destructive beyond the app's own data.
//
// Keep this list in sync with the keys written in: main.tsx / App.tsx
// (savage_desktop_customization, savage_developer_mode_unlocked),
// fileManager.ts (termux_gui_filesystem_v2, termux_gui_foldertree_v2),
// termuxBridge.ts (termux_bridge_config_v1), SettingsModal.tsx
// (savage_desktop_customization, termux_gui_filesystem_v2,
// savage_developer_mode_unlocked).
export const APP_LOCAL_STORAGE_KEYS = [
  'savage_desktop_customization',
  'savage_developer_mode_unlocked',
  'termux_gui_filesystem_v2',
  'termux_gui_foldertree_v2',
  'termux_bridge_config_v1'
] as const;

/** Remove only this app's own localStorage keys. Never localStorage.clear(). */
export function clearAppLocalStorage(): void {
  for (const key of APP_LOCAL_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // One key failing must not stop the rest being cleared.
    }
  }
}
