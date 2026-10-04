import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const PANE = 'ruflo'
const traderAllowed = atom({ plugin: 'ruflo-watch', key: 'traderAllowed' } as const, false)

const ONCE = 'Allow once'
const SESSION = 'Allow for this session'
const DENY = 'Deny'

const serverOf = (name: string) => (name.startsWith('mcp__') ? name.slice(5, name.lastIndexOf('__')) : '')
const toolOf = (name: string) => (name.startsWith('mcp__') ? name.slice(name.lastIndexOf('__') + 2) : name)

export const isTrader = (name: string) =>
  name.startsWith('mcp__') && (/neural[-_]?trader/i.test(serverOf(name)) || /^neural[-_]?trader/i.test(toolOf(name)))
export const isRuflo = (name: string) => name.startsWith('mcp__') && /ruflo|neural[-_]?trader/i.test(serverOf(name))

async function rufloSummary($: EngineInterface) {
  const [tools, commands] = await Promise.all([$.tool.list(), $.command.list()])

  return {
    tools: tools.filter(t => isRuflo(t.name)),
    commands: commands.filter(c => c.plugin?.startsWith('ruflo') ?? false),
  }
}

async function refreshStatus($: EngineInterface) {
  const { tools, commands } = await rufloSummary($)
  $.ui.status(
    tools.length + commands.length === 0 ? 'ruflo: not loaded' : `ruflo: ${tools.length} tools, ${commands.length} commands`,
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'ruflo', description: 'Show the ruflo tools and commands in a pane' })
    void refreshStatus($).catch(() => undefined)

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    void refreshStatus($).catch(() => undefined)

    return next(e)
  })

  on('command.run', { command: 'ruflo' }, async $ => {
    await refreshStatus($)
    await $.ui.open({ id: PANE, title: 'ruflo' })

    return { text: 'ruflo pane opened.' }
  })

  on('tool.call', async ($, e, next) => {
    if (!isTrader(e.tool) || (await read($, traderAllowed))) return next(e)

    let answer: string
    try {
      answer = await $.ui.ask(`Let neural-trader run ${toolOf(e.tool)}?`, {
        header: 'Trader',
        options: [ONCE, SESSION, DENY],
      })
    } catch {
      return { deny: `${$.plugin.name}: ${e.tool} needs your confirmation, and none was given.` }
    }

    if (answer === SESSION) await update($, traderAllowed, () => true)
    if (answer === ONCE || answer === SESSION) return next(e)

    return { deny: `${$.plugin.name}: you declined ${e.tool}.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const { tools, commands } = await rufloSummary($)
    const allowed = await read($, traderAllowed)
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 8)

    return (
      <Box flexDirection="column">
        <Text bold>Commands ({commands.length})</Text>
        {commands.length === 0 && <Text dimColor>None loaded.</Text>}
        {commands.slice(0, Math.ceil(room / 3)).map(c => (
          <Text>/{c.name}</Text>
        ))}
        <Text bold>Tools ({tools.length})</Text>
        {tools.length === 0 && <Text dimColor>None connected.</Text>}
        {tools.slice(0, room).map(t => (
          <Text dimColor={!isTrader(t.name)}>{toolOf(t.name)}</Text>
        ))}
        {tools.length > room && <Text dimColor>…and {tools.length - room} more</Text>}
        <Text dimColor>Trader tools: {allowed ? 'allowed for this session' : 'ask each time'}</Text>
      </Box>
    )
  })
}
