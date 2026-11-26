import clsx from 'clsx'
import { Shield as ShieldIcon, LoaderCircle as LoaderCircleIcon } from 'lucide-react'

import { CloudLogo } from '../../components/CloudLogo'
import { UiIcon } from '../../components/ui/ui-icon'
import { t } from '../../i18n'

import type { ReactNode } from 'react'

export function CloudflareConnect({
  connecting,
  onConnect,
  shareField,
}: {
  connecting: boolean
  shareField?: ReactNode
  onConnect: () => void
}) {
  return (
    <div className="-mt-1">
      <div className="relative flex flex-col items-center pt-3 pb-1">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-[18px] bg-white ring-1 ring-[#f38020]/25">
          <CloudLogo provider="cloudflare" size={34} />
        </div>
      </div>
      <p className="mt-3 text-center text-[12.5px] leading-relaxed text-secondary">
        {t(
          'Connect Cloudflare through Composio. On the hosted Connect Link page, enter a Cloudflare API token scoped to the accounts and DNS, Workers, R2, Pages, D1, or KV permissions Cerin needs.',
        )}
      </p>
      {shareField}
      <button
        type="button"
        onClick={onConnect}
        disabled={connecting}
        className={clsx(
          'mt-5 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl text-[13px] font-semibold text-white transition-all',
          'bg-[#f38020] hover:bg-[#f9943a] disabled:cursor-not-allowed disabled:opacity-70',
        )}
      >
        {connecting ? (
          <>
            <UiIcon size={16} icon={LoaderCircleIcon} className="h-4 w-4 animate-spin" />
            {t('Waiting for browser authorization…')}
          </>
        ) : (
          <>
            <CloudLogo provider="cloudflare" size={18} />
            {t('Connect with {name}', { name: 'Cloudflare' })}
          </>
        )}
      </button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-tertiary">
        <UiIcon size={14} icon={ShieldIcon} className="h-3.5 w-3.5" />
        {t(
          'The token goes directly to Composio and is never stored by Cerin or exposed to Bots or tasks.',
        )}
      </p>
    </div>
  )
}
