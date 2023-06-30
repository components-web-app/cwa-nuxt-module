import { AdminStore } from '../storage/stores/admin/admin-store'

export default class Admin {
  // eslint-disable-next-line no-useless-constructor
  public constructor (private adminStoreDefinition: AdminStore) {
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
