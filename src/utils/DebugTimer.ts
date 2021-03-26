import consola from 'consola'

/**
 * @fileoverview  Measure the execution time of multiple sections of your code,
 * then effortlessly print all the timer results at once to the console.
 * @author Anton Ivanov <anton@ivanov.hk>
 * see: https://github.com/anton-bot/debugging-timer/blob/master/index.js
 * Updated for local usage to use consola + minor updates.
 */

/**
 * Measure the execution time of multiple sections of your code, then
 * effortlessly print all the timer results at once to the console.
 */
export default class DebugTimer {
  private data: any

  constructor() {
    this.reset()
  }

  reset() {
    this.data = {}
  }

  /**
   * Begin the timer.
   * @param {string} name - Label, e.g. "loading file".
   */
  start(name) {
    if (this.data[name]) {
      consola.info(
        `Timer for ${name} already exists. Previous timing will be lost`
      )
    }
    this.data[name] = {
      start: Date.now()
    }
  }

  /**
   * End the timer.
   * @param {string} name - Label, e.g. "loading file".
   */
  end(name) {
    if (!this.data[name]) {
      return
    }
    this.data[name].end = Date.now()
    this.data[name].total = this.data[name].end - this.data[name].start
  }

  /**
   * Print the results to the console.
   * @returns {str} - The formatted result, same as those printed to console.
   */
  print() {
    let str = 'DebugTimer Results:\r\n'
    for (const name in this.data) {
      str += `${name}: ${this.data[name].total} ms \r\n`
    }

    consola.debug(str)
    this.reset()
    return str
  }
}
