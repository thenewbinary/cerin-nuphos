import { config } from '@/config'

/** Browser-facing links may use a separate host from OAuth callbacks and API calls. */
export function publicWebUrl(): string {
  return config.auth.publicWebUrl ?? config.auth.publicBaseUrl
}
