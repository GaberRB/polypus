import { Command } from 'commander';
import { retrieveContext } from '../lib/retrieve.js';

export const retrieveCommand = new Command('retrieve')
  .description('Retrieve semantically relevant context for a query')
  .argument('<query>', 'Natural language query to find relevant context')
  .action(async (query) => {
    await retrieveContext(query);
  });