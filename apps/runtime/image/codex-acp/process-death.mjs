// App Server's death, which a turn waiting for turn/completed races. Then the
// adapter exits after stdout drains, so the failed turn's error still reaches
// OpenAB, which starts a fresh adapter for the next message.
let cerinCodexDeathReject
const cerinCodexDeath = new Promise((_, reject) => {
  cerinCodexDeathReject = reject
})

cerinCodexDeath.catch(() => {})

function cerinCodexDied(code, signal) {
  const reason = signal
    ? `process terminated by signal ${signal}`
    : `process exited with code ${code}`

  logger.log(`Codex App Server died: ${reason}`)
  cerinCodexDeathReject(
    RequestError.internalError(undefined, cerinProcessDeathMessage('Codex', reason)),
  )
  setImmediate(() => process.stdout.write('', () => process.exit(1)))
}
