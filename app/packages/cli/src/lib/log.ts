const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'
const CYAN = '\x1b[36m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'

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

  ready(seeded: boolean) {
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
    this._integrationHint()
  },

  nextSteps(seeded: boolean) {
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
    this._integrationHint()
  },

  _integrationHint() {
    console.log(`  ${BOLD}Connect your data sources:${RESET}`)
    console.log(`    ${CYAN}hissuno integrations list${RESET}      ${DIM}# see all integrations${RESET}`)
    console.log(`    ${CYAN}hissuno integrations add slack${RESET} ${DIM}# connect Slack${RESET}`)
    console.log(`    ${CYAN}hissuno integrations add intercom${RESET} ${DIM}# connect Intercom${RESET}`)
    console.log()
  },
}
