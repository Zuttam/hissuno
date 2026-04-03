import { BOLD, DIM, RESET, CYAN, RED, YELLOW, GREEN } from './output.js'

export const log = {
  banner() {
    console.log()
    console.log(`  ${BOLD}${CYAN}Hissuno Setup${RESET}`)
    console.log(`  ${DIM}Unified context layer for product agents${RESET}`)
    console.log()
  },

  step(msg: string) {
    process.stdout.write(`  ${CYAN}>${RESET} ${msg}... `)
  },

  success(msg: string) {
    console.log(`  ${GREEN}\u2713${RESET} ${msg}`)
  },

  info(msg: string) {
    console.log(`  ${CYAN}i${RESET} ${msg}`)
  },

  warn(msg: string) {
    console.log(`  ${YELLOW}!${RESET} ${msg}`)
  },

  error(msg: string) {
    console.log(`  ${RED}\u2717${RESET} ${msg}`)
  },

  fatal(msg: string) {
    console.log()
    console.log(`  ${BOLD}${RED}Error: ${msg}${RESET}`)
    console.log(`  ${DIM}Run with --help for usage information${RESET}`)
    console.log()
  },

  ready(seeded: boolean, apiKey?: string) {
    console.log()
    console.log(`  ${BOLD}${GREEN}Setup complete! Starting Hissuno...${RESET}`)
    console.log()
    if (seeded) {
      console.log(`  ${DIM}Demo account:${RESET}`)
      console.log(`    Email:    admin@hissuno.com`)
      console.log(`    Password: admin123`)
      console.log()
    }
    console.log(`  ${DIM}Open http://localhost:3000${RESET}`)
    console.log()
    if (apiKey) {
      this._mcpHint(apiKey)
    }
    this._integrationHint()
  },

  nextSteps(seeded: boolean, apiKey?: string) {
    console.log()
    console.log(`  ${BOLD}${GREEN}Setup complete!${RESET}`)
    console.log()
    console.log(`  ${BOLD}Next steps:${RESET}`)
    console.log()
    console.log(`    cd hissuno/app`)
    console.log(`    npm run dev`)
    console.log()
    if (seeded) {
      console.log(`  ${DIM}Demo account:${RESET}`)
      console.log(`    Email:    admin@hissuno.com`)
      console.log(`    Password: admin123`)
      console.log()
    }
    console.log(`  ${DIM}Then open http://localhost:3000${RESET}`)
    console.log()
    if (apiKey) {
      this._mcpHint(apiKey)
    }
    this._integrationHint()
  },

  _mcpHint(apiKey: string) {
    console.log(`  ${BOLD}Connect to Claude Code / Cursor / Claude Desktop:${RESET}`)
    console.log()
    console.log(`  ${DIM}Add to your MCP config (.mcp.json, claude_desktop_config.json, etc.):${RESET}`)
    console.log()
    console.log(`    ${CYAN}{${RESET}`)
    console.log(`    ${CYAN}  "mcpServers": {${RESET}`)
    console.log(`    ${CYAN}    "hissuno": {${RESET}`)
    console.log(`    ${CYAN}      "type": "streamable-http",${RESET}`)
    console.log(`    ${CYAN}      "url": "http://localhost:3000/mcp",${RESET}`)
    console.log(`    ${CYAN}      "headers": {${RESET}`)
    console.log(`    ${CYAN}        "Authorization": "Bearer ${apiKey}"${RESET}`)
    console.log(`    ${CYAN}      }${RESET}`)
    console.log(`    ${CYAN}    }${RESET}`)
    console.log(`    ${CYAN}  }${RESET}`)
    console.log(`    ${CYAN}}${RESET}`)
    console.log()
    console.log(`  ${DIM}Then ask your agent: "What are the top customer issues?"${RESET}`)
    console.log()
  },

  _integrationHint() {
    console.log(`  ${BOLD}Connect your data sources:${RESET}`)
    console.log(`    ${CYAN}hissuno integrations list${RESET}      ${DIM}# see all integrations${RESET}`)
    console.log(`    ${CYAN}hissuno integrations add slack${RESET} ${DIM}# connect Slack${RESET}`)
    console.log(`    ${CYAN}hissuno integrations add intercom${RESET} ${DIM}# connect Intercom${RESET}`)
    console.log()
  },
}
