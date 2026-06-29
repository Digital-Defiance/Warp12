/** Drop Cache Storage entries, then hard-refresh the page. */
export async function forceReloadPage(): Promise<void> {
  const cacheStorage = window.caches;
  if (cacheStorage) {
    const keys = await cacheStorage.keys();
    await Promise.all(keys.map((key) => cacheStorage.delete(key)));
  }

  window.location.reload();
}
