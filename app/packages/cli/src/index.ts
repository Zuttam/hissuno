/**
 * Hissuno CLI - Entry Point
 */

import { Command } from 'commander'
import { typesCommand } from './commands/types.js'
import { listCommand } from './commands/list.js'
import { getCommand } from './commands/get.js'
import { searchCommand } from './commands/search.js'
import { addCommand } from './commands/add.js'
import { integrationsCommand } from './commands/integrations.js'
import { updateCommand } from './commands/update.js'
import { setupCommand } from './commands/setup.js'
import { configCommand } from './commands/config.js'
import { profileCommand } from './commands/profile.js'
import { skillsCommand } from './commands/skills.js'
import { statusCommand } from './commands/status.js'
import { membersCommand } from './commands/members.js'
import { loginCommand } from './commands/login.js'
import { logoutCommand } from './commands/logout.js'
import { compileCommand } from './commands/compile.js'
import { sanitizeCommand } from './commands/sanitize.js'
import { pluginCommand } from './commands/plugin.js'
import { automationsCommand } from './commands/automations.js'
import { externalRecordsCommand } from './commands/external_records.js'

const program = new Command()
  .name('hissuno')
  .description('Hissuno CLI - set up, configure, and query your product intelligence data')
  .version('0.2.0')
  .option('--json', 'Output as JSON')

program.addCommand(loginCommand)
program.addCommand(logoutCommand)
program.addCommand(setupCommand)
program.addCommand(configCommand)
program.addCommand(profileCommand)
program.addCommand(skillsCommand)
program.addCommand(statusCommand)
program.addCommand(typesCommand)
program.addCommand(listCommand)
program.addCommand(getCommand)
program.addCommand(searchCommand)
program.addCommand(addCommand)
program.addCommand(updateCommand)
program.addCommand(integrationsCommand)
program.addCommand(membersCommand)
program.addCommand(compileCommand)
program.addCommand(sanitizeCommand)
program.addCommand(pluginCommand)
program.addCommand(automationsCommand)
program.addCommand(externalRecordsCommand)

program.parseAsync(process.argv)
