<template>
  <div class="cwa-multiselect">
    <button class="button toggle-button" @click="toggleIsAdding">
      <icon-add v-if="!isAdding" class="icon-add" />
      <span v-else>&lt;</span>
    </button>
    <div v-if="!isAdding" class="view is-read">
      <div v-if="currentValue && currentValue.length" class="selected-items">
        <ul class="selected-items-list">
          <li
            v-for="op of normalizedCurrentValue"
            :key="`cwa-multiselect-selected-option-${op.value}`"
          >
            <a
              :class="['option-item', { 'is-selected': optionIsSelected(op) }]"
              @click="toggleOption(op.value)"
            >
              <span>{{ op.label }}</span>
              <icon-add class="icon-add" />
            </a>
          </li>
        </ul>
      </div>
      <div v-else class="no-options-placeholder">No options selected</div>
    </div>
    <div v-else class="view is-write">
      <div>
        <input
          v-model="searchValue"
          type="text"
          placeholder="Search"
          class="search-input"
        />
      </div>
      <ul v-if="filteredNormalizedOptions.length" class="options-list">
        <li
          v-for="op of filteredNormalizedOptions"
          :key="`cwa-multiselect-option-${op.value}`"
        >
          <a
            :class="['option-item', { 'is-selected': optionIsSelected(op) }]"
            @click="toggleOption(op.value)"
          >
            <span>{{ op.label }}</span>
            <icon-add class="icon-add" />
          </a>
        </li>
      </ul>
      <div v-else class="no-options-placeholder">No results</div>
    </div>
  </div>
</template>

<script>
import SelectMixin from '@cwa/nuxt-module/core/mixins/SelectMixin'
import IconAdd from '../../../assets/images/icon-add.svg?inline'
export default {
  components: { IconAdd },
  mixins: [SelectMixin],
  props: {
    value: {
      type: Array,
      required: false,
      default: null
    }
  },
  data() {
    return {
      isAdding: false,
      searchValue: null
    }
  },
  computed: {
    filteredNormalizedOptions() {
      if (!this.searchValue) {
        return this.normalizedOptions
      }
      return this.normalizedOptions.filter(({ label }) => {
        return label.toLowerCase().includes(this.searchValue.toLowerCase())
      })
    },
    optionIsSelected() {
      return (op) => {
        return this.currentValue && this.currentValue.includes(op.value)
      }
    },
    normalizedCurrentValue() {
      return this.normalizeValues(this.currentValue)
    }
  },
  methods: {
    toggleOption(value) {
      const currentIndex = !this.currentValue
        ? -1
        : this.currentValue.indexOf(value)
      if (currentIndex !== -1) {
        this.currentValue.splice(currentIndex, 1)
        return
      }
      if (!this.currentValue) {
        this.currentValue = []
      }
      this.currentValue.push(value)
      this.updateValue()
    },
    toggleIsAdding() {
      if (!this.isAdding) {
        this.searchValue = null
      }
      this.isAdding = !this.isAdding
    },
    updateValue() {
      // currently this will emit normalized options.. { label: string, value: any }
      // we should really be emitting whatever the user had provided though
      // this.$emit('input', this.currentValue)
      this.$emit('change', this.currentValue)
    }
  }
}
</script>

<style lang="sass">
.cwa-multiselect
  display: flex
  .toggle-button
    margin-right: 1rem
    .icon-add
      height: .8em
  .no-options-placeholder
    color: $cwa-color-text-light
    opacity: .6
    font-weight: $font-weight-light
  .view
    display: flex
    align-items: center
  ul.selected-items-list,
  ul.options-list
    list-style: none
    margin: 0
    padding: 0
    display: flex
    min-height: 100%
    align-items: center
    li
      margin: 0
      padding-left: 1rem
      &:first-child
        padding-left: 0
  .option-item
    display: flex
    position: relative
    align-items: center
    background: $cwa-background-dark
    padding: 0 .5rem 0 .75rem
    height: $control-height
    line-height: 1em
    border-radius: .4rem
    cursor: pointer
    transition: background-color .3s
    font-size: .85em
    &:hover
      background: lighten($cwa-background-dark, 10%)
      color: $white
    .icon-add
      margin-left: .75rem
      width: auto
      transform: scale(.5)
    &.is-selected
      color: $white
      &:hover
        background: $color-danger
        color: $white
      .icon-add
        transform: rotate(45deg) scale(.58)
  .search-input
    +cwa-input
    background: $cwa-background-dark
    border-color: $cwa-background-dark
    margin: 0 1rem 0 0
    width: 180px
    &:hover
      border-color: $cwa-color-text-light
    &:focus
      border-color: $white
</style>
