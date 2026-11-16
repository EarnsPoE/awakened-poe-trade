import type { ServerEvents } from '../server'
import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'

export class ConfigStore {
  private isTmpFile = false
  private cfgPath = path.join(app.getPath('userData'), 'apt-data', 'config.json')
  // Saves run one at a time, so two writes never race on the same temp file.
  private saveQueue: Promise<void> = Promise.resolve()

  constructor (server: ServerEvents) {
    server.onEventAnyClient('CLIENT->MAIN::save-config', (cfg) => {
      this.saveQueue = this.saveQueue.then(() => this.save(cfg.contents, cfg.isTemporary))
      server.sendEventTo('broadcast', {
        name: 'MAIN->CLIENT::config-changed',
        payload: { contents: cfg.contents }
      })
    })
  }

  async load (): Promise<string | null> {
    // A UI reload (e.g. wedge recovery) saves and then asks for the config right away,
    // so let any save still in progress finish first.
    await this.saveQueue
    const contents = await readJson(this.cfgPath)
    if (contents != null) return contents
    // config.json is missing or unreadable: fall back to the previous good copy.
    return await readJson(this.cfgPath + '.bak')
  }

  private async save (contents: string, tmp: boolean) {
    // Upstream skipped saving in dev builds. This fork runs the dev build day to day,
    // so it saves there too.

    if (tmp && !this.isTmpFile) {
      this.cfgPath += '.tmp'
      this.isTmpFile = true
    }
    try {
      await fs.mkdir(path.dirname(this.cfgPath), { recursive: true })
      await writeFileDurable(this.cfgPath, contents)
    } catch {
      app.exit(1)
    }
  }
}

async function readJson (filePath: string): Promise<string | null> {
  try {
    const contents = await fs.readFile(filePath, 'utf8')
    JSON.parse(contents)
    return contents
  } catch {
    return null
  }
}

// Writes the new contents to a temp file, flushes it to disk, keeps the old file as
// `<file>.bak`, then renames the temp file over the old one. A crash or forced kill at
// any point leaves either the old file or the new one, never a half-written file.
export async function writeFileDurable (filePath: string, contents: string) {
  const writingPath = filePath + '.writing'
  const handle = await fs.open(writingPath, 'w')
  try {
    await handle.writeFile(contents, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }

  // The backup is copied aside and renamed into place too, so it is never half-written.
  if (await readJson(filePath) != null) {
    await fs.copyFile(filePath, filePath + '.bak.writing')
    await renameWithRetry(filePath + '.bak.writing', filePath + '.bak')
  }

  await renameWithRetry(writingPath, filePath)
}

// On Windows a rename can fail for a moment while antivirus or the indexer has
// the file open, so retry a few times.
async function renameWithRetry (from: string, to: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.rename(from, to)
      return
    } catch (e) {
      if (attempt >= 5) throw e
      await new Promise(resolve => setTimeout(resolve, 50 * attempt))
    }
  }
}
