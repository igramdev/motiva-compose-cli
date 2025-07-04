import { Command } from 'commander';
import chalk from 'chalk';
import { EventBus } from '@motiva/core';

const program = new Command();
program
  .name('motiva-compose')
  .description('Motiva Compose CLI (WIP)')
  .version('0.0.1');

program
  .command('run')
  .description('Pipeline を実行')
  .requiredOption('-p, --pipeline <file>', 'pipeline JSON file')
  .option('--plugins <dir>', 'plugins directory', './plugins')
  .action(async (opts) => {
    console.log(chalk.blue('🚀 run command is not implemented yet'));
    console.log('pipeline:', opts.pipeline, 'plugins:', opts.plugins);
    // TODO: 実装
  });

program.parseAsync().catch((err) => {
  console.error(chalk.red('CLI error'), err);
  process.exit(1);
}); 