import fsSync from 'node:fs'
import path from 'node:path'

import { app } from 'electron'

// The Cerin mark on a navy (A, the bundled icon), light (B) or dark (C) tile.
export const APP_ICONS = ['A', 'B', 'C']

const file = () => path.join(app.getPath('userData'), 'app-icon.json')

export function readAppIcon(): string {
  try {
    const { icon } = JSON.parse(fsSync.readFileSync(file(), 'utf8')) as { icon?: unknown }

    if (typeof icon === 'string' && APP_ICONS.includes(icon)) return icon
  } catch {
    // No choice saved yet.
  }

  return 'A'
}

/** Shows the icon on the running Dock tile. Finder keeps the bundled icon. */
export function applyAppIcon(icon: string) {
  if (process.platform !== 'darwin') return
  // electron-builder packs public/ into dist/; dev serves it from public/.
  app.dock?.setIcon(
    path.join(app.getAppPath(), app.isPackaged ? 'dist' : 'public', 'app-icons', `${icon}.png`),
  )
}

export function setAppIcon(icon: string) {
  if (!APP_ICONS.includes(icon)) throw new Error(`Invalid app icon: ${icon}`)
  fsSync.writeFileSync(file(), JSON.stringify({ icon }), 'utf8')
  applyAppIcon(icon)
}
