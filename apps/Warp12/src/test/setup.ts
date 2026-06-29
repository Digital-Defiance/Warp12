/** Polyfill localStorage when a spec runs outside the app's jsdom environment. */
function installLocalStorageMock(): void {
  if (typeof globalThis.localStorage !== 'undefined') {
    return;
  }

  const storage = new Map<string, string>();
  globalThis.localStorage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    key(index: number) {
      return [...storage.keys()][index] ?? null;
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
  };
}

installLocalStorageMock();
