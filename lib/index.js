export const name = 'dsh-math'
export const inject = []

// dsh-math runs almost entirely in the browser. The server side only needs to
// exist so the plugin can be mounted in a profile; all rendering happens in
// lib/client.js.
export function apply(ctx) {
  ctx?.logger?.debug?.('dsh-math: server side ready')
}
