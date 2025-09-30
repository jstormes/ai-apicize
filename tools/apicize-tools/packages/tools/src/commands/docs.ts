import { Command } from 'commander';
import { writeFileSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';

export function createDocsCommand(): Command {
  const command = new Command('docs');

  command
    .description('Export documentation files for AI assistants and developers')
    .option('-o, --output <path>', 'Output directory for documentation', '.')
    .option('-t, --type <type>', 'Documentation type: ai|all', 'all')
    .action(async (options) => {
      try {
        const outputDir = resolve(options.output);
        const docType = options.type.toLowerCase();

        console.log(chalk.blue('📚 Exporting Apicize documentation...'));
        console.log(chalk.gray(`Output directory: ${outputDir}`));

        // Read the AI Assistant Guide from the packaged location
        const guideSource = join(__dirname, '../../../lib/docs/AI_ASSISTANT_GUIDE.md');
        let exported = 0;

        if (docType === 'ai' || docType === 'all') {
          try {
            const guideContent = readFileSync(guideSource, 'utf-8');
            const guideDest = join(outputDir, 'AI_ASSISTANT_GUIDE.md');
            writeFileSync(guideDest, guideContent, 'utf-8');
            console.log(chalk.green(`✓ Exported AI_ASSISTANT_GUIDE.md`));
            exported++;
          } catch (error: any) {
            console.error(chalk.red(`✗ Failed to export AI_ASSISTANT_GUIDE.md: ${error.message}`));
          }
        }

        if (exported === 0) {
          console.log(chalk.yellow('⚠ No documentation files exported'));
          process.exit(1);
        } else {
          console.log(chalk.green(`\n✓ Successfully exported ${exported} documentation file(s)`));
        }
      } catch (error: any) {
        console.error(chalk.red(`Error exporting documentation: ${error.message}`));
        process.exit(1);
      }
    });

  return command;
}
