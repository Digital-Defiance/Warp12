import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

/** Serve shipped Ω weights from `public/models` when tests fetch by URL. */
function installOmegaModelFetchMock(): void {
  const modelsDir = resolve(import.meta.dirname, '../../public/models');
  const files: Record<string, string> = {
    '/models/omega-v1.json': 'omega-v1.json',
    '/models/omega-goout-v1.json': 'omega-goout-v1.json',
  };

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.pathname
          : input.url;
    const path = Object.keys(files).find(
      (modelPath) => url === modelPath || url.endsWith(modelPath)
    );
    if (path) {
      const body = readFileSync(resolve(modelsDir, files[path]!), 'utf8');
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  };
}

installLocalStorageMock();
installOmegaModelFetchMock();
