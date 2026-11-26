import { ExternalLink, Loader2 } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'

import { api } from '../api'
import { CloudLogo } from '../components/CloudLogo'
import { Modal } from '../components/Modal'
import { Button } from '../components/ui/button'
import { toast } from '../components/ui/toast'
import { t } from '../i18n'
import { shareFromAllowList } from '../lib/bindingShare'

import { BindShareField } from './bind-account/share-field'
import { useResetOnKey } from './useResetOnKey'

type Props = {
  open: boolean
  teamId: string
  onClose: () => void
  onBound: () => void
}

export function BindGitlabDialog({ open, teamId, onClose, onBound }: Props) {
  const [shareList, setShareList] = useState<string[] | null>(null)
  const [waiting, setWaiting] = useState(false)
  const attemptRef = useRef(0)

  useEffect(() => {
    if (open || !waiting) return
    attemptRef.current += 1
    void api.atlasCancelGitlabOAuth(teamId).catch(() => {})
  }, [open, waiting, teamId])
  useResetOnKey(String(open), () => {
    if (open) {
      setShareList(null)
      setWaiting(false)
    }
  })

  async function startInstall() {
    const attempt = ++attemptRef.current

    setWaiting(true)
    try {
      await api.atlasStartGitlabOAuth(teamId, shareList ? shareFromAllowList(shareList) : undefined)
      if (attempt !== attemptRef.current) return
      setWaiting(false)
      onBound()
      onClose()
    } catch (e) {
      if (attempt !== attemptRef.current) return
      setWaiting(false)
      toast.apiError(t('Could not connect {name}', { name: 'GitLab' }), e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Connect {name}', { name: 'GitLab' })}
      description={t(
        'Connect gitlab.com through Composio so Cerin can read projects and repositories and work with merge requests and pipelines.',
      )}
      width={460}
    >
      <div className="px-5 py-5 selectable">
        {!waiting && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-surface-sunken flex items-center justify-center">
              <CloudLogo provider="gitlab" size={26} />
            </div>
            <div className="text-[12.5px] text-secondary leading-relaxed text-center max-w-[400px]">
              {t(
                'Authorize in your browser and you will return to Cerin automatically. Composio manages the GitLab app and its permissions. Self-managed GitLab instances and Git clone or push are not supported.',
              )}
            </div>
          </div>
        )}
        {!waiting && (
          <BindShareField
            teamId={teamId}
            provider="gitlab"
            value={shareList}
            onChange={setShareList}
          />
        )}
        {waiting && (
          <div className="flex flex-col items-center gap-4 py-3">
            <Loader2 className="w-6 h-6 text-primary animate-spin" strokeWidth={1.8} />
            <div className="text-[12.5px] text-secondary text-center">
              {t('Waiting for {name}… complete the authorization in your browser.', {
                name: 'GitLab',
              })}
            </div>
            <div className="text-[11px] text-tertiary text-center max-w-[380px]">
              {t(
                'If nothing happens, make sure your browser allowed the popup and that your OS routes {scheme} URLs to this app.',
              )
                .split('{scheme}')
                .map((part, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className="font-mono">cerin://</span>}
                    {part}
                  </Fragment>
                ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line-control bg-state-selected">
        <button
          onClick={onClose}
          className="h-8 px-3 rounded-md text-[12.5px] text-secondary hover:text-main hover:bg-state-hover"
        >
          {waiting ? t('Cancel') : t('Close')}
        </button>
        {!waiting && (
          <Button size="sm" onClick={() => void startInstall()}>
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.8} />
            {t('Authorize {name}', { name: 'GitLab' })}
          </Button>
        )}
      </div>
    </Modal>
  )
}
