import { computed, reactive } from 'vue'
import type { ComputedRef } from 'vue'
import type CwaFetch from './fetcher/cwa-fetch'
import type { CwaResourcesStoreInterface, ResourcesStore } from '../storage/stores/resources/resources-store'
import type { CwaResource } from '../resources/resource-utils'

export interface ViewVars {
  full_name: string
  name: string
  id: string
  unique_block_prefix: string
  valid: boolean
  submitted: boolean
  required: boolean
  value: any
  errors: string[]
  action?: string
  method?: string
  block_prefixes: string[]
  disabled: boolean
  checked?: boolean
  multiple?: boolean
  attr: {
    [key: string]: any
  }
  label?: string
  label_attr: {
    [key: string]: any
  }
  [key: string]: any
}

export interface FormView {
  vars: ViewVars
  prototype?: ApiFormView
}

interface ApiFormView {
  vars: ViewVars
  children: ApiFormView[]
  prototype?: ApiFormView | null
}

export interface KeyedFormView {
  [key: string]: FormView
}

function bracketToNested(flat: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.replace(/\]/g, '').split('[')
    let current = result
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i] as string
      if (typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {}
      }
      current = current[part]
    }
    const lastPart = parts[parts.length - 1] as string
    current[lastPart] = value
  }
  return result
}

export default class Forms {
  private readonly _resourcesStore: CwaResourcesStoreInterface
  private readonly _submitAttempted = reactive<Record<string, boolean>>({})
  private readonly _fieldValues = reactive<Record<string, Record<string, any>>>({})

  public constructor(
    resourcesStoreDefinition: ResourcesStore,
    private readonly cwaFetch: CwaFetch,
  ) {
    this._resourcesStore = resourcesStoreDefinition.useStore()
  }

  public isSubmitAttempted(iri: string): boolean {
    return this._submitAttempted[iri] ?? false
  }

  public setSubmitAttempted(iri: string, attempted: boolean): void {
    this._submitAttempted[iri] = attempted
  }

  public setFieldValue(iri: string, fullName: string, value: any): void {
    if (!this._fieldValues[iri]) {
      this._fieldValues[iri] = {}
    }
    this._fieldValues[iri][fullName] = value
  }

  public clearFieldValue(iri: string, fullName: string): void {
    if (this._fieldValues[iri]) {
      delete this._fieldValues[iri][fullName]
    }
  }

  public getFieldValues(iri: string): Record<string, any> {
    return { ...this._fieldValues[iri] }
  }

  private normalizeFormResponseId(resource: CwaResource): CwaResource {
    const id = resource['@id']
    const normalizedId = id.endsWith('/submit') ? id.slice(0, -'/submit'.length) : id
    const normalized: CwaResource = normalizedId !== id ? { ...resource, '@id': normalizedId } : resource

    // The 422/200 response from /submit may clear action/method in the root formView vars.
    // Preserve them from the existing stored resource so subsequent submissions still go to the right URL.
    const existingData = this.resourcesStore.current.byId[normalizedId]?.data
    const existingVars = existingData?.formView?.vars
    if (existingVars?.action || existingVars?.method) {
      const responseVars = normalized.formView?.vars ?? {}
      normalized.formView = {
        ...normalized.formView,
        vars: {
          ...responseVars,
          ...(existingVars.action && !responseVars.action ? { action: existingVars.action } : {}),
          ...(existingVars.method && !responseVars.method ? { method: existingVars.method } : {}),
        },
      }
    }

    return normalized
  }

  public async validateField(endpoint: string, body: Record<string, any>): Promise<void> {
    try {
      const response = await this.cwaFetch.fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/merge-patch+json',
          'accept': 'application/ld+json,application/json',
        },
        body: bracketToNested(body),
      })
      if (response?.['@id']) {
        this._resourcesStore.saveResource({ resource: this.normalizeFormResponseId(response) })
      }
    }
    catch (e: any) {
      if (e?.data?.['@id'] && e.data?.['@type'] !== 'Error') {
        this._resourcesStore.saveResource({ resource: this.normalizeFormResponseId(e.data) })
      }
    }
  }

  public async submitForm(
    endpoint: string,
    body: Record<string, any>,
    method: 'POST' | 'PATCH',
  ): Promise<{ success: boolean, formErrors?: string[] }> {
    try {
      const response = await this.cwaFetch.fetch(endpoint, {
        method,
        headers: {
          'content-type': method === 'PATCH' ? 'application/merge-patch+json' : 'application/ld+json',
          'accept': 'application/ld+json,application/json',
        },
        body: bracketToNested(body),
      })
      if (response?.['@id']) {
        this._resourcesStore.saveResource({ resource: response })
      }
      return { success: true }
    }
    catch (e: any) {
      if (e?.data?.['@id']) {
        this._resourcesStore.saveResource({ resource: this.normalizeFormResponseId(e.data) })
        return { success: false, formErrors: e.data?.formView?.vars?.errors ?? [] }
      }
      return { success: false }
    }
  }

  public getForm(iri: string): ComputedRef<KeyedFormView | undefined> {
    return computed(() => {
      const resource = this.resourcesStore.current.byId[iri]
      if (resource?.data?.['@type'] !== 'Form') {
        return
      }
      const createFormViewObject = (apiFormView: ApiFormView): KeyedFormView => {
        const structuredFormView: FormView = {
          vars: Object.assign({}, apiFormView.vars),
        }
        if (apiFormView.prototype) {
          structuredFormView.prototype = apiFormView.prototype
        }
        let data: KeyedFormView = {
          [apiFormView.vars.full_name]: structuredFormView,
        }
        if (apiFormView.children) {
          for (const child of apiFormView.children) {
            data = { ...data, ...createFormViewObject(child) }
          }
        }
        return data
      }
      return createFormViewObject(resource.data.formView)
    })
  }

  public getFormViewErrors(formIri: string, field: string) {
    return computed(() => {
      const form = this.getForm(formIri)
      const errors = form.value?.[field]?.vars.errors
      return errors && errors.length ? errors : undefined
    })
  }

  private get resourcesStore(): CwaResourcesStoreInterface {
    return this._resourcesStore
  }
}
