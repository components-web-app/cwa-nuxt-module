<template>
  <div class="row pagination-bar">
    <div class="column page-numbers">
      <a>1</a>
      <a>2</a>
      <a>3</a>
      <a>4</a>
    </div>
    <div class="column is-narrow">
      <div class="row">
        <div class="column">
          <a><img src="../assets/images/arrow-left.svg" alt="Left Arrow - Previous Page" /></a>
        </div>
        <div class="column">
          <a><img src="../assets/images/arrow-right.svg" alt="Right Arrow - Next Page" /></a>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="sass">
.pagination-bar
  margin-top: 2rem
  color: $white
  a
    opacity: 0.6
    &:hover,
    &.selected
      opacity: 1
      color: $white
  .page-numbers
    a
      padding: 0 1rem
</style>
