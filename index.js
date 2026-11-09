export const name = 'ai-reader'
export const inject = ['webServer']

// Thin, cache-stable entry. The implementation lives in host.js and is imported
// with a per-activation query so editing it during development takes effect on
// the next plugin remount (Node's ESM cache otherwise keeps the old module).
export async function apply(ctx, config) {
  const url = new URL(`./host.js?t=${Date.now()}`, import.meta.url)
  const mod = await import(url.href)
  await mod.apply(ctx, config)
}
