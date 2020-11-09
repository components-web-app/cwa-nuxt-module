<template>
  <div v-if="total" class="row pagination-bar is-mobile">
    <div class="column page-numbers">
      <a v-for="page in displayPages" :key="`page${page}`" @click.prevent="changePage(page)" :class="{'selected': current === page}" href="#">{{ page }}</a>
    </div>
    <div class="column is-narrow">
      <div class="row is-mobile">
        <div class="column">
          <a :disabled="isFirst" @click.prevent="changePage(current-1)" href="#"><img src="../../assets/images/arrow-left.svg" alt="Left Arrow - Previous Page" /></a>
        </div>
        <div class="column">
          <a :disabled="isLast" @click.prevent="changePage(current+1)" href="#"><img src="../../assets/images/arrow-right.svg" alt="Right Arrow - Next Page" /></a>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    total: {
      type: Number,
      required: false,
      default: null,
      validator: function (value) {
        return value === null || value >= 1
      }
    },
    current: {
      type: Number,
      required: false,
      default: null,
      validator: function (value) {
        return value >= 1
      }
    },
    displayMax: {
      type: Number,
      required: false,
      default: null
    }
  },
  computed: {
    isFirst() {
      return this.current === 1
    },
    isLast() {
      return this.current === this.total
    },
    displayPages() {
      const allPages = Array.from(Array(this.total), (_,x) => x+1)
      if (!this.displayMax) {
        return allPages
      }
      const displayPages = []
      displayPages.push(this.current)
      let lowest = this.current
      let highest = this.current
      let displayCounter = 1
      while(displayCounter < this.displayMax) {
        displayCounter++
        if ((displayCounter % 2 === 0 || highest >= this.total) && lowest > 1) {
          lowest--
          displayPages.unshift(lowest)
          continue
        }
        if(highest < this.total) {
          highest++
          displayPages.push(highest)
        }
      }
      return displayPages
    }
  },
  methods: {
    changePage(newPage) {
      if (newPage < 1 || newPage > this.total) {
        return
      }
      this.$emit('change', newPage)
    }
  }
}
</script>

<style lang="sass">
.pagination-bar
  margin-top: 2rem
  color: $white
  a
    opacity: 0.6
    &[disabled]
      opacity: .2
    &:hover:not([disabled]),
    &.selected
      opacity: 1
      color: $white
  .page-numbers
    a
      padding: 0 1rem
</style>
