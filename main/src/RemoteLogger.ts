import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { ServerEvents } from './server'

// Keep the log after a restart, so the first error of a problem that shows up
// hours later (like a wedged UI) can still be read.
const LOG_FILE_MAX_SIZE = 2 * 1024 * 1024

export class Logger {
  history = ''
  readonly filePath = path.join(app.getPath('userData'), 'apt-data', 'overlay.log')
  private file?: fs.WriteStream

  constructor (
    private server: ServerEvents
  ) {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      const size = fs.statSync(this.filePath, { throwIfNoEntry: false })?.size ?? 0
      if (size > LOG_FILE_MAX_SIZE) {
        fs.renameSync(this.filePath, this.filePath + '.1')
      }
      this.file = fs.createWriteStream(this.filePath, { flags: 'a' })
      this.file.on('error', () => { this.file = undefined })
      this.file.write(`\n===== ${new Date().toISOString()} start v${app.getVersion()} =====\n`)
    } catch {
      this.file = undefined
    }
  }

  write (message: string) {
    message = `[${new Date().toLocaleTimeString()}] ${message}\n`
    this.history += message
    this.file?.write(message)
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::log-entry',
      payload: { message }
    })
  }
}
