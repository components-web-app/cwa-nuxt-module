<template>
  <div class="cwa-admin-dialog-item">
    <div class="header">
      {{ item.name || 'Unnamed' }}
      <span class="icons">
            <span class="icon is-layouts">
              <span>0</span>
            </span>
            <span class="icon is-pages">
              <span>0</span>
            </span>
            <span class="icon is-components">
              <span>0</span>
            </span>
          </span>
    </div>
    <div>
      {{ item.resource['@type']}}
    </div>
  </div>
</template>

<script>
export default {
  props: {
    item: {
      type: Object,
      required: true
    }
  }
}
</script>

<style lang="sass">
.cwa-admin-dialog-item
  .header
    background: $cwa-grid-item-background
    padding: .5rem
    display: flex
    .icons
      margin-left: 1em
      display: inline-flex
      .icon
        padding-left: 1.2em
        display: flex
        position: relative
        align-items: center
        &:not(:first-child)
          margin-left: .5em
        span
          font-size: .7em
          display: inline-block
          border-radius: .6em
          background: $cwa-color-text-light
          color: $cwa-grid-item-background
          text-align: center
          line-height: 1.3em
          padding: 0 .5em
        &:before
          content: ''
          background: 0 50% no-repeat
          background-size: 100% auto
          position: absolute
          top: 0
          left: 0
          height: 100%
          width: .9em
          opacity: .6
        &.is-layouts:before
          background-image: url("../../../../assets/images/icon-layout.svg")
        &.is-pages:before
          background-image: url("../../../../assets/images/icon-pages.svg")
        &.is-components:before
          background-image: url("../../../../assets/images/icon-components.svg")
</style>
