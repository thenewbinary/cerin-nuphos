import { t } from '../../i18n/index.ts'

import type { AgentDevice } from '../../api/device-types.ts'

function updateHint(device: AgentDevice, thisComputer: boolean): string {
  if (device.box)
    return device.access === 'use'
      ? t('Ask a workspace administrator to update it.')
      : t('Update it from its ⋯ menu.')
  if (thisComputer) return t('Restart Cerin from the Help menu to update it.')
  // Cerin on a person's computer is theirs to update, whoever else manages the computer.
  if (device.access !== 'owner') return t('Ask its owner to update Cerin on it.')
  if (device.outdated === 'cli') return t('Run “cerin update” on it.')

  return device.app?.update?.ready
    ? t('Update it from its ⋯ menu.')
    : t('Open Cerin on it and restart to update.')
}

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
