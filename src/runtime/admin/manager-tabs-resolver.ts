import { defineAsyncComponent } from 'vue'
import { CwaResourceMeta, ManagerTab } from '#cwa/module'
import { CwaCurrentResourceInterface } from '#cwa/runtime/storage/stores/resources/state'
import { getPublishedResourceState } from '#cwa/runtime/resources/resource-utils'

export const DEFAULT_TAB_ORDER = 50

interface resolveTabsOps { resourceType?: string, resourceConfig?: CwaResourceMeta, resource: CwaCurrentResourceInterface }

export default class ManagerTabsResolver {
  private* getComponentGroupTabs () {
    yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/group/component.vue'))
    yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/group/position.vue'))
  }

  private* getComponentPositionTabs () {
    yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/position/static-component.vue'))
    yield defineAsyncComponent(() => import('#cwa/runtime/templates/components/main/admin/resource-manager/_tabs/position/dynamic-component.vue'))
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
