import { expect, test } from 'claude-code/testing'

const TRADER = 'mcp__plugin_ruflo-neural-trader_neural-trader__execute_trade'

test('a trader tool is denied when the question is dismissed', async ($, on) => {
  let ran = false
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ deny: 'dismissed' }))
  on('tool.call', { tool: TRADER }, () => {
    ran = true
    return { result: 'filled' }
  })

  const out = await $.tool.call({ tool: TRADER, symbol: 'AAPL' })

  expect(ran).toBe(false)
  expect(out.deny ?? '').toMatch(/confirmation/)
})

test('other tools pass through without a question', async ($, on) => {
  let asked = false
  on('tool.call', { tool: 'AskUserQuestion' }, () => {
    asked = true
    return { deny: 'unexpected' }
  })
  on('tool.call', { tool: 'mcp__plugin_ruflo-core_ruflo__memory_search' }, () => ({ result: 'ok' }))

  const out = await $.tool.call({ tool: 'mcp__plugin_ruflo-core_ruflo__memory_search', query: 'x' })

  expect(asked).toBe(false)
  expect(out.deny).toBeUndefined()
})
