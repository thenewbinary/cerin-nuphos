import { optional } from './env'

export function cliConfig() {
  return {
    // GitHub owner/repository serving stable cli-v<version> releases.
    releasesRepo: optional('CERIN_CLI_RELEASES_REPO') ?? 'thenewbinary/cerin-nuphos',
  }
}
