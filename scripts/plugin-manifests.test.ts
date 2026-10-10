import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
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
const releases = read('.github/.release-please-manifest.json')
const skills = readdirSync(`${repo}/plugins/reviews/skills`).sort()

describe('the Reviews plugin manifests', () => {
  it('share their metadata', () => {
    for (const field of ['name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords']) {
      expect(claudePlugin[field], field).toEqual(plugin[field])
    }
    expect(claudePlugin.displayName).toBe(openai.displayName)
    expect(claudePlugin.icon).toBe(openai.logo)
  })

  it('carry the version release-please last released', () => {
    expect(plugin.version).toBe(releases['plugins/reviews'])
    expect(read('package.json').version).toBe(releases['.'])
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

  it('declare every skill in the Claude marketplace entry', () => {
    expect(claudeMarketplace.plugins[0].skills).toEqual(skills.map((skill) => `./skills/${skill}`))
  })

  it('point at files that exist', () => {
    for (const path of [openai.logo, openai.composerIcon, claudePlugin.icon]) {
      expect(existsSync(`${repo}/plugins/reviews/${path}`), path).toBe(true)
    }
  })
})

// `npx skills add` copies only a skill's own directory, so each skill keeps its
// own copy of the connection setup instead of linking up into the plugin.
describe('the Reviews plugin skills', () => {
  it.each(skills)('%s links only to files inside its own directory', (skill) => {
    const dir = `${repo}/plugins/reviews/skills/${skill}`
    const links = [...readFileSync(`${dir}/SKILL.md`, 'utf8').matchAll(/\]\(([^)#\s]+)[^)]*\)/g)]
      .map((match) => match[1])
      .filter((link) => !/^[a-z]+:/i.test(link))
    for (const link of links) {
      const target = join(dir, link)
      expect(relative(dir, target).startsWith('..'), link).toBe(false)
      expect(existsSync(target), link).toBe(true)
    }
  })

  it('keep their connection setup copies equal', () => {
    const [first, ...rest] = skills.map((skill) => readFileSync(`${repo}/plugins/reviews/skills/${skill}/references/connection.md`, 'utf8'))
    for (const copy of rest) expect(copy).toBe(first)
  })
})
