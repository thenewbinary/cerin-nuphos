/** Stop an orphaned local backend before it can keep reconciling shared runtimes. */
const state = globalThis as typeof globalThis & { __cerinStopLauncherWatchdog?: () => void }

export function watchDevLauncher(raw: string | undefined, onExit: () => void): () => void {
  state.__cerinStopLauncherWatchdog?.()
  const pid = Number(raw)

  if (!raw || !/^\d+$/u.test(raw) || !Number.isSafeInteger(pid) || pid <= 1) return () => {}

  const stop = () => {
    clearInterval(timer)
    if (state.__cerinStopLauncherWatchdog === stop) delete state.__cerinStopLauncherWatchdog
  }
  const check = () => {
    try {
      process.kill(pid, 0)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return
      stop()
      onExit()
    }
  }
  const timer = setInterval(check, 1_000)

  timer.unref()
  state.__cerinStopLauncherWatchdog = stop
  check()

  return stop
}
