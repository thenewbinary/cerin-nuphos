import { readLocalStorage, writeLocalStorage } from '../../app/localStorage.ts'

export function morningPaperLastSeenKey(userId: string, teamId: string): string {
  return `cerin.morningPaperLastSeen.${JSON.stringify([userId, teamId])}`
}

export function readMorningPaperLastSeen(userId: string, teamId: string): number | null {
  const raw = readLocalStorage(morningPaperLastSeenKey(userId, teamId))
  const value = Number(raw)

  return raw !== null && raw.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null
}

export function recordMorningPaperLastSeen(userId: string, teamId: string, at: number): void {
  writeLocalStorage(morningPaperLastSeenKey(userId, teamId), String(at))
}
