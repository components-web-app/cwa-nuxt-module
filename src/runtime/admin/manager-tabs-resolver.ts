import { defineAsyncComponent } from 'vue'
import type { CwaResourceMeta, ManagerTab } from '#cwa/module'
import type { CwaCurrentResourceInterface } from '#cwa/runtime/storage/stores/resources/state'
import { getPublishedResourceState } from '#cwa/runtime/resources/resource-utils'
import { useCwa } from '#imports'
import type Cwa from '#cwa/runtime/cwa'

export const DEFAULT_TAB_ORDER = 50

interface resolveTabsOps { resourceType?: string, resourceConfig?: CwaResourceMeta, resource: CwaCurrentResourceInterface }

export default class ManagerTabsResolver {
  private cwa: Cwa
  constructor () {
    this.cwa = useCwa()
  }

  private* getComponentGroupTabs () {
    yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/group/component.vue'))
    yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/group/position.vue'))
  }

  private* getComponentPositionTabs () {
    if (this.cwa.resources.isPageDynamic.value) {
      yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/position/dynamic.vue'))
      return
    }
    if (this.cwa.resources.isPageTemplate.value) {
      yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/position/template.vue'))
    }
    yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/position/static.vue'))
  }

  private* getComponentTabs (resource: CwaCurrentResourceInterface) {
    yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/component/ui.vue'))
    yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/component/order.vue'))
    if (getPublishedResourceState(resource) !== undefined) {
      yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/component/publish.vue'))
    }
  }

  public resolve (ops: resolveTabsOps) {
    let tabs: ManagerTab[] = [
      defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/resource-info-tab.vue'))
    ]
    if (ops.resourceConfig?.managerTabs) {
      tabs = [...tabs, ...ops.resourceConfig.managerTabs]
    }

    if (ops.resourceType) {
      switch (ops.resourceType) {
        case 'ComponentGroup':
          tabs = [...tabs, ...this.getComponentGroupTabs()]
          break
        case 'ComponentPosition':
          tabs = [...tabs, ...this.getComponentPositionTabs()]
          break
        default:
          tabs = [...tabs, ...this.getComponentTabs(ops.resource)]
          break
      }
    }

    return tabs
  }
}
