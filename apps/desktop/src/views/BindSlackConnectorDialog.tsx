import { faSlack } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ExternalLink as ExternalLinkIcon, LoaderCircle as LoaderCircleIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { api } from '../api'
import { Modal } from '../components/Modal'
import { Button } from '../components/ui/button'
import { toast } from '../components/ui/toast'
import { UiIcon } from '../components/ui/ui-icon'
import { t } from '../i18n'
import { shareFromAllowList } from '../lib/bindingShare'

import { BindShareField } from './bind-account/share-field'

import { Fill } from './bind-account/shared'
import { useResetOnKey } from './useResetOnKey'

type Props = {
  open: boolean
  teamId: string
  onClose: () => void
  onBound: () => void
}

type Phase = 'idle' | 'waiting'

export function BindSlackConnectorDialog({ open, teamId, onClose, onBound }: Props) {
  const [shareList, setShareList] = useState<string[] | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const attemptRef = useRef(0)

  useEffect(() => {
    if (open || phase !== 'waiting') return
    attemptRef.current += 1
    void api.atlasCancelSlackIntegrationOAuth(teamId).catch(() => {})
  }, [open, phase, teamId])

  useResetOnKey(String(open), () => {
    if (open) setShareList(null)
    if (open) setPhase('idle')
  })

  async function startInstall() {
    const attempt = ++attemptRef.current

    setPhase('waiting')
    try {
      await api.atlasStartSlackIntegrationOAuth(
        teamId,
        shareList ? shareFromAllowList(shareList) : undefined,
      )
      if (attempt !== attemptRef.current) return
      setPhase('idle')
      onBound()
      onClose()
    } catch (e) {
      if (attempt !== attemptRef.current) return
      setPhase('idle')
      toast.apiError(t('Could not connect {name}', { name: 'Slack' }), e, {
        fallback: t(
          'Slack authorization did not complete. Try again or ask a team administrator to check the connection settings.',
        ),
      })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Connect {name}', { name: 'Slack' })}
      description={t(
        'Connect Slack through Composio to let Bots and tasks read channels and threads and post messages. This does not enable two-way chat with Cerin in Slack. Access starts with the authorizing member only.',
      )}
      width={460}
    >
      <div className="px-5 py-5 selectable">
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-surface-sunken flex items-center justify-center">
              <FontAwesomeIcon icon={faSlack} className="w-[22px] h-[22px] text-main" />
            </div>
            <div className="text-[12.5px] text-secondary leading-relaxed text-center max-w-[400px]">
              {t(
                "Click below to open {name} in your browser. Approve the OAuth request and you'll be redirected back automatically.",
                { name: 'Slack' },
              )}
            </div>
          </div>
        )}

        {phase !== 'waiting' && (
          <BindShareField
            teamId={teamId}
            provider="slack"
            value={shareList}
            onChange={setShareList}
          />
        )}

        {phase === 'waiting' && (
          <div className="flex flex-col items-center gap-4 py-3">
            <UiIcon
              size={20}
              icon={LoaderCircleIcon}
              className="w-5 h-5 text-primary animate-spin"
            />
            <div className="text-[12.5px] text-secondary text-center">
              {t('Waiting for {name}… complete the authorization in your browser.', {
                name: 'Slack',
              })}
            </div>
            <div className="text-[11px] text-tertiary text-center max-w-[380px]">
              <Fill
                text={t(
                  'If nothing happens, make sure your browser allowed the popup and that your OS routes {scheme} URLs to this app.',
                )}
                scheme={<span className="font-mono">cerin://</span>}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line-control bg-state-selected">
        <button
          onClick={onClose}
          className="h-8 px-3 rounded-md text-[12.5px] text-secondary hover:text-main hover:bg-state-hover"
        >
          {phase === 'waiting' ? t('Cancel') : t('Close')}
        </button>
        {phase !== 'waiting' && (
          <Button size="sm" onClick={() => void startInstall()}>
            <UiIcon size={16} icon={ExternalLinkIcon} className="w-4 h-4" />
            {t('Authorize {name}', { name: 'Slack' })}
          </Button>
        )}
      </div>
    </Modal>
  )
}
