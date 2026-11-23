// No app data source exists yet; returning null keeps the dashboard on real activity counts.
// The screenshot harness replaces this hook with sample outcomes outside src.
export type OutcomeMetric = {
  id: string
  value: string
  label: string
  caption?: string
  featured?: boolean
  trend?: number[]
}

export type ProofItem = {
  id: string
  sessionId: string
  image: string
  caption: string
  botSessionId?: string
}

export type MorningPaperOutcomes = {
  objective: string
  metrics: OutcomeMetric[]
  proof: ProofItem[]
}

export function useMorningPaperOutcomes(_teamId: string): MorningPaperOutcomes | null {
  return null
}
