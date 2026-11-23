/** Soft fill under the lead series; `d` is the closed area beneath its line. */
export function LeadGlow({ id, d }: { id: string; d: string }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor="color-mix(in srgb, rgb(var(--color-status-warning)) 11%, transparent)"
          />
          <stop
            offset="100%"
            stopColor="color-mix(in srgb, rgb(var(--color-status-warning)) 0%, transparent)"
          />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#${id})`} />
    </>
  )
}
