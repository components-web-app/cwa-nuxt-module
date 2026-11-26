import { useRouter } from '#app/composables/router'
import { extensionRouteName } from '../admin/extension-areas'

export function cwaAdminRoute(extension: string, page: string, iri?: string) {
  const name = `${extensionRouteName(extension, page)}${iri === undefined ? '' : '-iri'}`
  if (import.meta.env.DEV && !useRouter().hasRoute(name)) {
    throw new Error(`cwaAdminRoute: the extension area "${extension}" has no admin page "${page}"${iri === undefined ? '' : ' with an item page'}`)
  }
  return iri === undefined ? { name } : { name, params: { iri } }
}
