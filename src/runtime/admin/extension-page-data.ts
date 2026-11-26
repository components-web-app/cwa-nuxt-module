import type { Component } from 'vue'
import type { CwaApiDocumentationDataInterface } from '../storage/stores/api-documentation/state'
import { pageDataTypes } from './page-data-types'

export interface ExtensionPageDataTab {
  key: string
  label: string
  role: string
  property: string
  component: Component
}

export interface ExtensionPageDataList {
  label: string
  property: string
  columns: { label: string, component: Component }[]
}

export function classHasProperty(docs: CwaApiDocumentationDataInterface | undefined, className: string | undefined, property: string) {
  const name = className?.split('\\').pop()
  return !!name && !!docs?.docs?.supportedClass?.find(supportedClass => supportedClass.title === name)?.supportedProperty?.some(supportedProperty => supportedProperty.title === property)
}

export function pageDataTypesWithProperty(docs: CwaApiDocumentationDataInterface | undefined, property: string) {
  return pageDataTypes(docs).flatMap((type) => {
    const className = type.resourceClass.split('\\').pop() ?? ''
    const endpoint = docs?.entrypoint?.[className.charAt(0).toLowerCase() + className.slice(1)]
    return endpoint && classHasProperty(docs, className, property) ? [{ className, endpoint }] : []
  })
}

export function pageDataTabsFor(tabs: ExtensionPageDataTab[], { docs, className, hasRole, hidden }: {
  docs: CwaApiDocumentationDataInterface | undefined
  className: string | undefined
  hasRole: (role: string) => boolean
  hidden: string[] | undefined
}) {
  return tabs.filter(tab => classHasProperty(docs, className, tab.property) && hasRole(tab.role) && !hidden?.includes(tab.key))
}
