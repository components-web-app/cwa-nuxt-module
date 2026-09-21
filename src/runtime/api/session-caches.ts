export async function clearSessionCaches(names: string[]): Promise<void> {
  if (!names.length || !('caches' in globalThis)) {
    return
  }
  await Promise.all(names.map(name => Promise.resolve()
    .then(() => caches.delete(name))
    .catch(() => false)))
}
