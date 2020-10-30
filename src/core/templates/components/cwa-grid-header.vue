<template>
  <div>
    <div class="cwa-header row is-mobile">
      <div class="column is-narrow">
        <h1>{{ title }}</h1>
      </div>
      <div class="column is-narrow">
        <cwa-add-button />
      </div>
    </div>
    <div class="cwa-filter-bar row">
      <div class="column is-narrow">
        <input type="text" name="search" placeholder="Search" v-model="search" :class="{'has-content': search}" />
      </div>
      <div class="column is-narrow">
        <div class="select">
          <select name="order" v-model="order">
            <option value="created=desc">New - Old</option>
            <option value="created=asc">Old - New</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import CwaAddButton from './cwa-add-button'
export default {
  components: {CwaAddButton},
  props: {
    title: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      search: null,
      order: 'created=desc'
    }
  }
}
</script>
