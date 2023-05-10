import { computed, ComputedRef } from 'vue'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
interface ViewVars {
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
/* eslint-enable camelcase */

interface FormView {
  vars: ViewVars
}

interface ApiFormView {
  vars: ViewVars
  children: ApiFormView[]
}

interface KeyedFormView {
  [key: string]: FormView
}

export default class Forms {
  private resourcesStoreDefinition: ResourcesStore
  public constructor (
    resourcesStoreDefinition: ResourcesStore
  ) {
    this.resourcesStoreDefinition = resourcesStoreDefinition
  }

  public getForm (iri: string): ComputedRef<KeyedFormView|undefined> {
    return computed(() => {
      const resource = this.resourcesStore.current.byId[iri]
      if (resource?.data?.['@type'] !== 'Form') {
        return
      }
      const createFormViewObject = (apiFormView: ApiFormView): KeyedFormView => {
        const structuredFormView: FormView = {
          vars: Object.assign({}, apiFormView.vars)
        }
        let data: KeyedFormView = {
          [apiFormView.vars.full_name]: structuredFormView
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

  public getFormViewErrors (formIri: string, field: string) {
    return computed(() => {
      const form = this.getForm(formIri)
      const errors = form.value?.[field].vars.errors
      return errors && errors.length ? errors : undefined
    })
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}
