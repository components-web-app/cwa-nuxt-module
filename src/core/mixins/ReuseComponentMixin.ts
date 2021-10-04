import Vue from 'vue'

export default Vue.extend({
  computed: {
    reuseComponent: {
      get(): string {
        return this.$cwa.$state.reuse.component
      },
      set(value: string) {
        this.$cwa.$storage.setReuseComponent(value)
      }
    },
    reuseDestination: {
      get(): string {
        return this.$cwa.$state.reuse.destination
      },
      set(value: string) {
        this.$cwa.$storage.setReuseDestination(value)
      }
    },
    reuseNavigate: {
      get(): boolean {
        return this.$cwa.$state.reuse.navigate
      },
      set(value: boolean) {
        this.$cwa.$storage.setReuseNavigate(value)
      }
    }
  },
  methods: {
    reuse(useBefore = false) {
      this.$cwa.reuseComponent(useBefore)
    },
    cancelReuse() {
      this.reuseComponent = null
      this.reuseDestination = null
      this.reuseNavigate = false
    }
  }
})
