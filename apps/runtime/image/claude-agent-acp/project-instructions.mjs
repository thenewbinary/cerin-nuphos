import { lstat as cerinProjectLstat, readFile as cerinProjectRead } from 'node:fs/promises'
import { join as cerinProjectJoin } from 'node:path'

// Project settings (hooks, MCP servers, env, permissions) are not loaded: anyone
// who can write the shared working directory could plant them for the next
// turn. The directory's CLAUDE.md still guides the agent, appended as plain
// text. A symlink is ignored so it cannot pull in a file from elsewhere.
export async function cerinWithProjectInstructions(systemPrompt, cwd) {
  const file = cerinProjectJoin(cwd, 'CLAUDE.md')
  const stat = await cerinProjectLstat(file).catch(() => null)
  if (!stat?.isFile()) return systemPrompt
  const text = (await cerinProjectRead(file, 'utf8')).trim()
  if (!text) return systemPrompt
  const notes = `Contents of ${file} (project instructions, checked into the codebase):\n\n${text}`
  if (typeof systemPrompt === 'string') return `${systemPrompt}\n\n${notes}`
  return { ...systemPrompt, append: [systemPrompt.append, notes].filter(Boolean).join('\n\n') }
}
