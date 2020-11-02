<template>
  <cwa-modal @close="$emit('close')">
    <div>
      <h2>Layout Details</h2>
    </div>
    <div>
      Hi
    </div>
  </cwa-modal>
</template>

<script>
import commonMixin from '../commonMixin'
import CwaModal from '../../../components/cwa-modal'

export default {
  components: {CwaModal},
  mixins: [commonMixin]
}
</script>
