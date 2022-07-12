<template>
  <div v-if="total > 1" class="row pagination-bar is-mobile">
    <div class="column page-numbers">
      <template v-if="showFirstPageLink">
        <a href="#" @click.prevent="changePage(1)">1</a> <span>..</span>
      </template>
      <a
        v-for="page in displayPages"
        :key="`page${page}`"
        :class="{ selected: current === page }"
        href="#"
        @click.prevent="changePage(page)"
        >{{ page }}</a
      >
      <template v-if="showLastPageLink">
        <span>..</span>
        <a href="#" @click.prevent="changePage(total)">{{ total }}</a>
      </template>
    </div>
    <div class="column is-narrow">
      <div class="row is-mobile">
        <div class="column">
          <a
            :disabled="isFirst"
            href="#"
            @click.prevent="changePage(current - 1)"
            ><img
              src="../../assets/images/arrow-left.svg"
              alt="Left Arrow - Previous Page"
          /></a>
        </div>
        <div class="column">
          <a
            :disabled="isLast"
            href="#"
            @click.prevent="changePage(current + 1)"
            ><img
              src="../../assets/images/arrow-right.svg"
              alt="Right Arrow - Next Page"
          /></a>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import VueRouter from 'vue-router'
import QueryHelperMixin from '../../mixins/QueryHelperMixin'
const { isNavigationFailure, NavigationFailureType } = VueRouter

export default {
  mixins: [QueryHelperMixin],
  props: {
    total: {
      type: Number,
      required: true,
      validator(value) {
        return value >= 1
      }
    },
    displayMax: {
      type: Number,
      required: false,
      default: null
    },
    pageParameter: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      current: 1,
      showFirstPageLink: false,
      showLastPageLink: false
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
      const allPages = Array.from(Array(this.total), (_, x) => x + 1)
      if (!this.displayMax) {
        return allPages
      }
      const displayPages = []
      displayPages.push(this.current)
      let lowest = this.current
      let highest = this.current
      let displayCounter = 1
      const actualMax = this.displayMax
      while (displayCounter < actualMax) {
        displayCounter++
        if ((displayCounter % 2 === 0 || highest >= this.total) && lowest > 1) {
          lowest--
          displayPages.unshift(lowest)
          continue
        }
        if (highest < this.total) {
          highest++
          displayPages.push(highest)
        }
      }
      return displayPages
    }
  },
  watch: {
    '$route.query'() {
      this.updateFromCurrentRoute()
    },
    displayPages(displayPages) {
      if (displayPages[0] !== 1) {
        this.showFirstPageLink = true
        displayPages.splice(0, 1)
      } else {
        this.showFirstPageLink = false
      }
      if (displayPages[displayPages.length - 1] !== this.total) {
        this.showLastPageLink = true
        displayPages.splice(-1)
      } else {
        this.showLastPageLink = false
      }
    }
  },
  mounted() {
    this.updateFromCurrentRoute()
  },
  methods: {
    updateFromCurrentRoute() {
      this.current = (this.$route.query[this.pageParameter] || 1) / 1
      if (this.current > this.total) {
        this.changePage(1)
      }
    },
    async changePage(newPage) {
      if (newPage < 1 || newPage > this.total) {
        return
      }
      this.current = newPage
      const query = Object.assign({}, this.$route.query, {
        [this.pageParameter]: newPage
      })
      try {
        await this.$router.replace({ query })
      } catch (failure) {
        if (isNavigationFailure(failure, NavigationFailureType.duplicated)) {
          return
        }
        throw failure
      }
    }
  }
}
</script>

<style lang="sass">
.pagination-bar
  margin-top: 2rem
  color: $white
  user-select: none
  cursor: default
  span
    opacity: 0.6
    margin: 0 -.5rem
    font-size: .8em
    z-index: 0
    pointer-events: none
  a
    z-index: 1
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
