// Stand-in for the Workers runtime module in unit tests, which run in Node.
export const env = {}

const background: Promise<unknown>[] = []

export function waitUntil(promise: Promise<unknown>) {
  background.push(promise)
}

/** Waits for everything handed to waitUntil so far. */
export async function settleBackground() {
  while (background.length > 0) await Promise.allSettled(background.splice(0))
}
