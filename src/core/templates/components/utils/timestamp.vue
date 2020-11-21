<template>
  <span>
    {{ formattedTimestamp }}
  </span>
</template>

<script>
import moment from "moment";

export default {
  props: {
    timestamp: {
      type: Date,
      required: true
    },
    updateFrequency: {
      type: Number,
      default: 5000
    }
  },
  data() {
    return {
      formattedTimestamp: null,
      updateInterval: null
    }
  },
  mounted() {
    this.updateTimestamp()
    this.updateInterval = setInterval(this.updateTimestamp, this.updateFrequency)
  },
  beforeDestroy() {
    clearInterval(this.updateInterval)
  },
  methods: {
    updateTimestamp() {
      this.formattedTimestamp = moment(this.timestamp).fromNow()
    }
  }
}
</script>
