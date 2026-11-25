import { t } from '../../i18n/index.ts'
import { newerVersion } from '../../lib/agentUpdate.ts'

import type { AgentDevice } from '../../api/device-types.ts'

function updateHint(device: AgentDevice, thisComputer: boolean): string {
  if (device.box)
    return device.access === 'use'
      ? t('Ask a team administrator to update it.')
      : t('Update it from its ⋯ menu.')
  if (thisComputer) return t('Restart Cerin from the Help menu to update it.')
  // Cerin on a person's computer is theirs to update, whoever else manages the computer.
  if (device.access !== 'owner') return t('Ask its owner to update Cerin on it.')
  if (device.outdated === 'cli') return t('Run “cerin update” on it.')

  // An outdated Cerin Desktop is older than 0.133.2, so it is quit by hand, not restarted.
  return device.app?.update?.ready
    ? t('Quit Cerin fully on it (⌘Q on a Mac) and reopen it. If it doesn’t close, quit it again.')
    : t(
        'Open Cerin on it and let the update download, then quit it fully (⌘Q on a Mac) and reopen it.',
      )
}

/** Whether Cerin Desktop restarts into its update when asked to. Before 0.133.2 the restart can
 *  leave it running without windows and the update uninstalled (#4524). */
export const restartsIntoUpdate = (app: NonNullable<AgentDevice['app']>) =>
  !newerVersion('0.133.2', app.version)

/** What a computer's card says when its Cerin is older than the backend supports, and the way this viewer updates it. */
export function outdatedNotice(
  device: AgentDevice,
  thisComputer: boolean,
): { text: string; hint: string } | null {
  if (!device.outdated) return null

  return {
    text: t('Cerin on this computer is out of date'),
    hint: updateHint(device, thisComputer),
  }
}
