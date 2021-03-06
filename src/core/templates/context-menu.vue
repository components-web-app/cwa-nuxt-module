<template>
  <ul v-if="$cwa.isAdmin && showing" class="context-menu" @click.stop :style="menuStyle">
    <template v-for="(items,category) in menuData">
      <template v-if="loading">
        <li class="header">Loading...</li>
      </template>
      <template v-else>
        <li class="header" :key="category">{{ category }}</li>
        <li v-for="({ label, options: { active } }, index) in items" :key="`${label}-${index}`"><a href="#" @click.prevent="doCallback(category, index)" :class="{ disabled: active }">{{ label }}</a></li>
      </template>
    </template>
  </ul>
</template>

<script>
export default {
  data() {
    return {
      showing: false,
      heightOffset: 10,
      widthOffset: 10,
      left: 0,
      top: 0,
      menuData: {},
      loading: false
    }
  },
  computed: {
    menuStyle() {
      return {
        left: `${this.left}px`,
        top: `${this.top}px`
      }
    }
  },
  methods: {
    positionMenu(top, left, element) {
      const elementHeight = element.offsetHeight;
      const largestHeight = window.innerHeight - elementHeight - this.heightOffset;

      const elementWidth = element.offsetWidth;
      const largestWidth = window.innerWidth - elementWidth - this.widthOffset;

      if (top > largestHeight) {
        top = largestHeight;
      }

      if (left > largestWidth) {
        left = largestWidth;
      }

      return [top, left];
    },
    open(event) {
      if (!this.$cwa.isAdmin) {
        return
      }

      this.menuData = {}
      this.$root.$emit('contextmenu.show', this)
      if (Object.keys(this.menuData).length === 0) {
        return
      }

      event.preventDefault()
      this.showing = true

      this.$nextTick(() => {
        [this.top, this.left] = this.positionMenu(event.clientY, event.clientX, this.$el)

        this.$el.focus()
      });
    },
    close() {
      this.showing = false
    },
    addContextMenuData({ category, data, component }) {
      const resolvedCategory = category || 'default'
      let newData = this.menuData[resolvedCategory] ? this.menuData[resolvedCategory] : []
      for (const [label, options] of Object.entries(data)) {
        newData.push({
          label,
          options,
          component
        })
      }
      this.$set(this.menuData, resolvedCategory, newData)
    },
    async doCallback(category, index) {
      this.loading = true
      const itemData = this.menuData[category][index]
      this.$set(itemData.options, 'active', true)
      await itemData.options.callback.call(itemData.component)
      this.$set(itemData.options, 'active', false)
      this.showing = false
      this.loading = false
    }
  },
  mounted() {
    window.addEventListener('contextmenu', this.open)
    window.addEventListener('click', this.close)
    this.$el.addEventListener('contextmenu', (e) => { e.stopPropagation(); e.preventDefault() })
    this.$root.$on('context-menu-add-data', this.addContextMenuData)
  },
  beforeDestroy() {
    window.removeEventListener('contextmenu', this.open)
    window.removeEventListener('click', this.close)
    this.$root.$off('context-menu-add-data', this.addContextMenuData)
  }
}
</script>

<style lang="sass" scoped>
.context-menu
  position: absolute
  display: inline-flex
  flex-direction: column
  list-style: none
  margin: 0
  padding: 0
  box-shadow: 1px 1px 2px 1px $color-quaternary
  background: $color-initial
  min-width: 150px
  li
    margin: 0
    &.header
      padding: .5rem
      text-transform: capitalize
      font-size: 1rem
      color: $color-secondary
      font-weight: $font-weight-bold
      background: $color-tertiary
    a
      display: block
      padding: .5rem
      &.active
        opacity: .5
      &:hover
        background: $color-primary
        color: $color-initial
</style>
