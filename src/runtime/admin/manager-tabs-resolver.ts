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
  constructor() {
    this.cwa = useCwa()
  }

  private* getComponentGroupTabs() {
    yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/group/Component.vue'))
    yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/group/Position.vue'))
  }

  private* getComponentPositionTabs() {
    if (this.cwa.resources.isDataPage.value) {
      yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/position/DataPage.vue'))
      return
    }
    if (this.cwa.resources.isDynamicPage.value) {
      yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/position/DynamicPage.vue'))
    }
    // Should have had to have a static component already assigned - should not have data variable options, easy to select the component, no need for tab?
    // yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/position/Static.vue'))
  }

  private* getComponentTabs(resource: CwaCurrentResourceInterface) {
    yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/component/Ui.vue'))
    yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/component/Order.vue'))
    if (getPublishedResourceState(resource) !== undefined) {
      yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/component/Publish.vue'))
    }
  }

  public resolve(ops: resolveTabsOps) {
    let tabs: ManagerTab[] = [
      defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/ResourceInfoTab.vue')),
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
