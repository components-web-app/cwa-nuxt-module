import { computed, reactive } from 'vue'
import type { ComputedRef } from 'vue'
import type CwaFetch from './fetcher/cwa-fetch'
import type { CwaResourcesStoreInterface, ResourcesStore } from '../storage/stores/resources/resources-store'

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
}

interface ApiFormView {
  vars: ViewVars
  children: ApiFormView[]
}

export interface KeyedFormView {
  [key: string]: FormView
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

  public async validateField(endpoint: string, body: Record<string, any>): Promise<void> {
    try {
      const response = await this.cwaFetch.fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/merge-patch+json',
          'accept': 'application/ld+json,application/json',
        },
        body,
      })
      if (response?.['@id']) {
        this._resourcesStore.saveResource({ resource: response })
      }
    }
    catch (e: any) {
      if (e?.data?.['@id']) {
        this._resourcesStore.saveResource({ resource: e.data })
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
        body,
      })
      if (response?.['@id']) {
        this._resourcesStore.saveResource({ resource: response })
      }
      return { success: true }
    }
    catch (e: any) {
      if (e?.data?.['@id']) {
        this._resourcesStore.saveResource({ resource: e.data })
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
