import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { ShieldCheck } from 'lucide-react'

import { SectionHeader } from '../../components/SectionHeader'
import { t } from '../../i18n'
import { useRefreshKey, useTabPollMs } from '../../lib/query/tabQuery'

import { formatExpiry } from './common'
import { cloudflarePermissionsQuery } from './iamQueries'
import { EmptyHint, ProviderSummaryCard, Warnings } from './permissionCards'
import { SelfManagementCard } from './SelfManagementCard'

import type { CommonProps } from './common'

export function CloudflareIamPermissionsView({
  teamId,
  accountId,
  refreshKey,
  onLoading,
}: CommonProps & { accountId: string }) {
  const query = useQuery({
    ...cloudflarePermissionsQuery(teamId, accountId),
    refetchInterval: useTabPollMs(),
  })
  const data = query.data ?? null
  const error = query.error?.message ?? null
  const loading = query.isPending

  useRefreshKey(query, refreshKey, onLoading)

  if (!data) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {error && (
            <div className="m-4 p-3 rounded-md border border-error/40 bg-error/10 text-[12.5px] text-error">
              {error}
            </div>
          )}
          {loading && (
            <div className="px-6 py-5 text-[12.5px] text-tertiary">{t('Checking connection…')}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {error && (
          <div className="m-4 p-3 rounded-md border border-error/40 bg-error/10 text-[12.5px] text-error">
            {error}
          </div>
        )}
        <ProviderSummaryCard
          provider="cloudflare"
          title={data.tokenName ?? data.tokenId ?? t('API token')}
          subtitle={data.accountId}
          rows={[
            { label: t('Account ID'), value: data.accountId, mono: true },
            {
              label: t('Token status'),
              value: data.tokenStatus ?? '—',
              status:
                data.tokenStatus === 'active' ? 'success' : data.tokenStatus ? 'error' : undefined,
            },
            { label: t('Expires'), value: formatExpiry(data.expiresOn) },
          ]}
        />
        <SelfManagementCard capabilities={data.selfCapabilities} />
        <Warnings warnings={data.warnings} />
        <section className="px-6 py-4">
          <SectionHeader
            icon={<ShieldCheck className="w-4 h-4 text-primary" strokeWidth={1.8} />}
            title={t('Token policies')}
            hint={
              data.policies === null
                ? t("Couldn't read token policies (token lacks User Details: Read)")
                : data.policies.length === 1
                  ? t('{n} policy on this token', { n: data.policies.length })
                  : t('{n} policies on this token', { n: data.policies.length })
            }
          />
          {data.policies === null ? (
            <EmptyHint
              message={
                data.tokenStatus === 'active'
                  ? t(
                      'This token is account-scoped, so Cloudflare won\'t return its own policy list (only user-scoped tokens with "User Details: Read" can self-introspect). The token works for the granted account/zone APIs — view it in the Cloudflare dashboard at My Profile → API Tokens to see the exact permissions.',
                    )
                  : t(
                      'Cloudflare API tokens can only list their own policies if they include the "User Details: Read" permission. Add it to your Cerin token to see what was granted.',
                    )
              }
            />
          ) : data.policies.length === 0 ? (
            <EmptyHint
              message={t('This token has no policies attached, so every API call will be denied.')}
            />
          ) : (
            <div className="space-y-2">
              {data.policies.map((p, idx) => (
                <div
                  key={idx}
                  className={clsx(
                    'rounded-md border bg-surface-canvas px-3 py-2',
                    p.effect === 'allow' ? 'border-success/30' : 'border-error/30',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={clsx(
                        'text-[10.5px] uppercase tracking-wider font-semibold',
                        p.effect === 'allow' ? 'text-success' : 'text-error',
                      )}
                    >
                      {p.effect}
                    </span>
                    <span className="text-[11.5px] text-tertiary">{t('on resources')}</span>
                  </div>
                  <div className="mb-2 space-y-0.5">
                    {Object.entries(p.resources).map(([k, v]) => (
                      <div key={k} className="font-mono text-[11px] text-secondary break-all">
                        {k}
                        {v === '*' ? '' : ` → ${v}`}
                      </div>
                    ))}
                  </div>
                  {p.permissionGroups.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.permissionGroups.map((g) => (
                        <span
                          key={g.id}
                          className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-surface-sheet text-secondary border border-line-control"
                          title={g.scopes?.join(', ')}
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
