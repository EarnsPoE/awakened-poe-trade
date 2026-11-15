import type { Plugin } from 'vite'
import path from 'path'
import { makeIndexFiles } from './make-index-files.mjs'

export function makeIndexFilesPlugin (): Plugin {
  let timeout: NodeJS.Timeout | null = null

  return {
    name: 'make-index-files',
    // Runs before Vite scans public/, so on a clean checkout the generated
    // *.index.bin files exist in time to be served instead of index.html
    config () {
      makeIndexFiles()
    },
    buildStart () {
      makeIndexFiles()
    },
    configureServer (server) {
      server.watcher.add(path.resolve(__dirname, '../../public/data/**/*.ndjson'))
      server.watcher.on('change', (file) => {
        if (file.endsWith('.ndjson')) {
          if (timeout) {
            clearTimeout(timeout)
          }
          timeout = setTimeout(() => {
            makeIndexFiles()
            server.config.logger.info('Regenerated all *.ndjson index files.', { timestamp: true })
            timeout = null
          }, 100)
        }
      })
    }
  }
}
