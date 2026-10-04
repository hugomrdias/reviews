import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Codex and Claude Code each read their own manifests from plugins/reviews, so
// the fields they share are written twice. These checks keep the copies equal.

const repo = fileURLToPath(new URL('..', import.meta.url))
const read = (path: string) => JSON.parse(readFileSync(`${repo}/${path}`, 'utf8'))

const plugin = read('plugins/reviews/plugin.json')
const claudePlugin = read('plugins/reviews/.claude-plugin/plugin.json')
const mcp = read('plugins/reviews/mcp.json')
const claudeMcp = read('plugins/reviews/.mcp.json')
const marketplace = read('.agents/plugins/marketplace.json')
const claudeMarketplace = read('.claude-plugin/marketplace.json')
const openai = plugin.extensions['com.openai'].interface

describe('the Reviews plugin manifests', () => {
  it('share their metadata', () => {
    for (const field of ['name', 'version', 'description', 'author', 'homepage', 'repository', 'keywords']) {
      expect(claudePlugin[field], field).toEqual(plugin[field])
    }
    expect(claudePlugin.displayName).toBe(openai.displayName)
    expect(claudePlugin.icon).toBe(openai.logo)
  })

  it('connect to the same server', () => {
    expect(claudeMcp.mcpServers.reviews.url).toBe(mcp.mcpServers.reviews.url)
  })

  it('are listed under the same name in both marketplaces', () => {
    const [codexEntry] = marketplace.plugins
    const [claudeEntry] = claudeMarketplace.plugins
    expect(codexEntry).toMatchObject({ name: plugin.name, source: { path: './plugins/reviews' }, category: openai.category })
    expect(claudeEntry).toMatchObject({ name: plugin.name, source: './plugins/reviews', displayName: openai.displayName, description: plugin.description })
    expect(marketplace.interface.displayName).toBe(openai.displayName)
  })

  it('point at files that exist', () => {
    for (const path of [openai.logo, openai.composerIcon, claudePlugin.icon]) {
      expect(existsSync(`${repo}/plugins/reviews/${path}`), path).toBe(true)
    }
  })
})
