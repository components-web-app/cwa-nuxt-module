import type { CwaOptions } from '../'
import Storage from './storage'

export default class Cwa {
  public ctx: any
  public options: CwaOptions

  public $storage: Storage
  public $state

  constructor (ctx, options) {
    this.ctx = ctx
    this.options = options

    // Storage & State
    options.initialState = { }
    const storage = new Storage(ctx, options)
    this.$storage = storage
    this.$state = storage.state
  }

  async init () {

  }
}
