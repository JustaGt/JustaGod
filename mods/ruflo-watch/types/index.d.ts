export type TraderAllowed = boolean

declare module 'claude-code' {
  interface PluginState {
    'ruflo-watch': { traderAllowed: TraderAllowed }
  }
}
