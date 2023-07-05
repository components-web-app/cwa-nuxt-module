import { AdminStore } from '../storage/stores/admin/admin-store'
import Manager from './manager'

export default class Admin {
  private managerInstance: Manager

  public constructor (private adminStoreDefinition: AdminStore) {
    this.managerInstance = new Manager()
  }

  public get manager () {
    return this.managerInstance
  }

  public toggleEdit (editing?: boolean): void {
    this.adminStore.toggleEdit(editing)
  }

  public setNavigationGuardDisabled (disabled: boolean) {
    this.adminStore.state.navigationGuardDisabled = disabled
  }

  public get navigationGuardDisabled () {
    return this.adminStore.state.navigationGuardDisabled
  }

  public get isEditing () {
    return this.adminStore.state.isEditing
  }

  private get adminStore () {
    return this.adminStoreDefinition.useStore()
  }
}
