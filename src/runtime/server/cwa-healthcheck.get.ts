import { defineEventHandler } from 'h3'
import pkg from '~/package.json'

const startTime = new Date()

export default defineEventHandler(() => {
  return {
    status: 'OK',
    uptime: process.uptime(),
    started: startTime,
    serverTime: new Date(),
    service: {
      name: pkg.name,
      version: pkg.version,
    },
  }
})
