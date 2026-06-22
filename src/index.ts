import { Command } from 'commander';
import { indexCommand } from './commands/index.js';
import { retrieveCommand } from './commands/retrieve.js';

// Add commands to the CLI
const program = new Command();
program.addCommand(indexCommand);
program.addCommand(retrieveCommand);

program.parse(process.argv);