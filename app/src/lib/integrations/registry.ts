/**
 * Central plugin registry.
 *
 * Each integration exports a `PluginDef` via `definePlugin({...})` from its own
 * file in `plugins/`. This module imports them all and exposes lookup helpers.
 */

import type { PluginDef } from './plugin-kit'
import { fathomPlugin } from './plugins/fathom'
import { zendeskPlugin } from './plugins/zendesk'
import { intercomPlugin } from './plugins/intercom'
import { gongPlugin } from './plugins/gong'
import { posthogPlugin } from './plugins/posthog'
import { linearPlugin } from './plugins/linear'
import { jiraPlugin } from './plugins/jira'
import { slackPlugin } from './plugins/slack'
import { notionPlugin } from './plugins/notion'
import { hubspotPlugin } from './plugins/hubspot'
import { githubPlugin } from './plugins/github'

const ALL_PLUGINS: PluginDef[] = [
  fathomPlugin,
  zendeskPlugin,
  intercomPlugin,
  gongPlugin,
  posthogPlugin,
  linearPlugin,
  jiraPlugin,
  slackPlugin,
  notionPlugin,
  hubspotPlugin,
  githubPlugin,
]

export const PLUGINS: Record<string, PluginDef> = Object.fromEntries(
  ALL_PLUGINS.map((p) => [p.id, p])
)

export function getPlugin(id: string): PluginDef | undefined {
  return PLUGINS[id]
}

export function listPlugins(): PluginDef[] {
  return Object.values(PLUGINS)
}

export function listAvailablePlugins(): PluginDef[] {
  return listPlugins().filter((p) => !p.comingSoon)
}
