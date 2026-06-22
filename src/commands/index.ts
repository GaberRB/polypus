import { Command } from 'commander';
import { createIndex } from '../lib/index.js';

export const indexCommand = new Command('index')
  .description('Build/update a local semantic index for the repository')
  .action(async () => {
    await createIndex();
  });