<template>
  <div
    v-if="$cwa.isEditMode && showing"
    class="cwa-admin-dialog"
    :style="menuStyle"
    @click.stop
  >
    <div
      class="arrow"
      :class="{ 'is-down': arrowIsDown }"
      :style="{ left: `${arrowLeft}px` }"
    />
    <ul>
      <cwa-admin-dialog-item
        v-for="item in menuItems"
        :key="item.resource['@id']"
        :item="item"
      />
    </ul>
  </div>
</template>

<script>
import consola from 'consola'
import { API_EVENTS } from '@cwa/nuxt-module/core/events'
import CwaAdminDialogItem from './cwa-admin-dialog-item'

export default {
  components: { CwaAdminDialogItem },
  data() {
    return {
      showing: false,
      invisible: false,
      heightMargin: 10,
      widthMargin: 10,
      left: 0,
      top: 0,
      menuItems: [],
      scope: null,
      arrowLeft: 0,
      arrowIsDown: false,
      clickTarget: null
    }
  },
  computed: {
    menuStyle() {
      return {
        left: `${this.left}px`,
        top: `${this.top}px`,
        opacity: this.invisible ? '0' : '1'
      }
    }
  },
  mounted() {
    window.addEventListener('click', this.open)
    this.$el.addEventListener('contextmenu', (e) => {
      e.stopPropagation()
      e.preventDefault()
    })
    this.$cwa.$eventBus.$on('cwa:admin-dialog:add-item', this.addItem)
    this.$cwa.$eventBus.$on(
      'cwa:admin-dialog:position',
      this.positionDialogListener
    )
    this.$cwa.$eventBus.$on(API_EVENTS.deleted, this.filterDeletedMenuItem)
    this.$cwa.$eventBus.$on(API_EVENTS.created, this.close)
    this.$cwa.$eventBus.$on(API_EVENTS.updated, this.close)
  },
  beforeDestroy() {
    window.removeEventListener('click', this.open)
    this.$cwa.$eventBus.$off('cwa:admin-dialog:add-item', this.addItem)
    this.$cwa.$eventBus.$off(
      'cwa:admin-dialog:position',
      this.positionDialogListener
    )
    this.$cwa.$eventBus.$off(API_EVENTS.deleted, this.filterDeletedMenuItem)
    this.$cwa.$eventBus.$off(API_EVENTS.created, this.close)
    this.$cwa.$eventBus.$off(API_EVENTS.updated, this.close)
  },
  methods: {
    positionMenu(clickY, clickX, element, useOffset = true) {
      const topOffset = 10 + (useOffset ? 10 : 0)
      const elementHeight = element.offsetHeight
      const elementWidth = element.offsetWidth

      let left = Math.max(clickX - elementWidth / 2, this.widthMargin)
      let top = clickY + topOffset

      const largestHeight =
        window.innerHeight - elementHeight - this.heightMargin
      const largestWidth = window.innerWidth - elementWidth - this.widthMargin

      if (top > largestHeight) {
        top = clickY - elementHeight - 10
        this.arrowIsDown = true
      } else {
        this.arrowIsDown = false
      }

      if (left > largestWidth) {
        left = largestWidth
      }

      return [top, left]
    },
    async open(event) {
      if (!this.$cwa.isEditMode) {
        return
      }

      this.clickTarget = event.target
      const originalLowestMenuItem = this.menuItems[this.menuItems.length - 1]
        ?.resource['@id']
      this.menuItems = []
      // allow components to populate data by emitting add-item event when listening to this event
      this.$cwa.$eventBus.$emit('cwa:admin-dialog:show', this)
      if (this.menuItems.length === 0) {
        this.showing = false
        consola.info('Not showing admin dialog. No menu data populated.')
        return
      }
      if (
        this.showing &&
        this.menuItems[this.menuItems.length - 1].resource['@id'] ===
          originalLowestMenuItem
      ) {
        this.showing = false
        return
      }

      event.preventDefault()
      this.invisible = true
      this.showing = true
      await this.positionDialog({ top: event.clientY, left: event.clientX })
      this.$cwa.$eventBus.$emit('cwa:admin-dialog:shown', this.menuItems)
      this.menuItems.forEach((item) => {
        this.$cwa.$eventBus.$emit('cwa:admin-dialog:shown-item', item)
      })
      this.invisible = false
    },
    positionDialog({ top, left }, useOffset = true) {
      return new Promise((resolve) => {
        if (!this.$el.tagName) {
          setTimeout(() => {
            this.positionDialog({ top, left }).then(() => {
              resolve()
            })
          }, 1)
          return
        }
        ;[this.top, this.left] = this.positionMenu(
          top,
          left,
          this.$el,
          useOffset
        )
        this.arrowLeft = Math.min(
          Math.max(left - this.left, 10),
          this.$el.clientWidth - 10
        )
        this.$el.focus()
        resolve()
      })
    },
    positionDialogListener({ top, left }) {
      this.positionDialog({ top, left }, false)
    },
    close() {
      this.showing = false
    },
    addItem({ name, resource, component }) {
      this.menuItems.push({ name, resource, component })
    },
    setScope(scope) {
      this.scope = scope
    },
    filterDeletedMenuItem(id) {
      this.menuItems = this.menuItems.filter(({ resource }) => {
        return resource['@id'] !== id
      })
      this.close()
    }
  }
}
</script>

<style lang="sass">
.cwa-admin-dialog
  position: absolute
  display: inline-flex
  flex-direction: column
  box-shadow: 0 0 10px 0 black
  background: $cwa-navbar-background
  min-width: 150px
  padding: 4px
  color: $cwa-color-text-light
  z-index: 500
  .arrow
    position: absolute
    left: 0
    transform: translateX(-50%)
    width: 0
    height: 0
    border-left: 10px solid transparent
    border-right: 10px solid transparent
    &:not(.is-down)
      bottom: 100%
      border-bottom: 10px solid $cwa-navbar-background
    &.is-down
      top: 100%
      border-top: 10px solid $cwa-navbar-background
  ul
    list-style: none
    margin: 0
    padding: 0
    li
      margin: 0
</style>
