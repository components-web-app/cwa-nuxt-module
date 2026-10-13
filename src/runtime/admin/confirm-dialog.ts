import type { App, Component } from 'vue'
import { lazyImport } from '../lazy-import'

const library = lazyImport(() => import('vuejs-confirm-dialog'))
const installedApps = new WeakSet<App>()

export async function createConfirmDialog(app: App, component: Component) {
  const { install, createConfirmDialog: createLibraryDialog } = await library.load()
  if (!installedApps.has(app)) {
    install(app)
    installedApps.add(app)
  }
  return createLibraryDialog(component as Parameters<typeof createLibraryDialog>[0])
}
