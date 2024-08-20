<template>
  <div class="cwa-flex cwa-justify-between cwa-items-center">
    <div class="cwa-text-stone-400">
      1 to 10 of 97 results
    </div>
    <div>
      <ul class="cwa-flex cwa-bg-dark cwa-rounded-lg cwa-overflow-hidden cwa-border cwa-border-stone-600">
        <ListPaginationButton>
          &lt;
        </ListPaginationButton>
        <ListPaginationButton>
          1
        </ListPaginationButton>
        <ListPaginationButton>
          2
        </ListPaginationButton>
        <ListPaginationButton>
          3
        </ListPaginationButton>
        <ListPaginationButton>
          ...
        </ListPaginationButton>
        <ListPaginationButton>
          8
        </ListPaginationButton>
        <ListPaginationButton>
          9
        </ListPaginationButton>
        <ListPaginationButton>
          10
        </ListPaginationButton>
        <ListPaginationButton>
          &gt;
        </ListPaginationButton>
      </ul>
    </div>
  </div>
</template>
<script setup lang="ts">
import ListPaginationButton from './ListPaginationButton.vue'
</script>
