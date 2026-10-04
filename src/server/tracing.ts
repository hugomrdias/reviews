import { tracing } from 'cloudflare:workers'

/**
 * Adds attributes to the invocation's span, so Workers Issues shows them with
 * the errors it groups. Never pass tokens or secrets.
 */
export function tagInvocation(attributes: Record<string, boolean | number | string | undefined>) {
  tracing.getActiveSpan()?.setAttributes(attributes)
}
