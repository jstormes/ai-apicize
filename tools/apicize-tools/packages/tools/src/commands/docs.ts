import { Command } from 'commander';
import { writeFileSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';

export function createDocsCommand(): Command {
  const command = new Command('docs');

  command
    .description(`Export documentation files for AI assistants and developers

Exports comprehensive documentation to help AI assistants and developers work
effectively with Apicize tools. Includes LLM-friendly guides, examples, and
best practices.

📝 Examples:
  # Export to current directory
  apicize-tools docs

  # Export to custom directory
  apicize-tools docs --output ./docs

  # Export only AI assistant guide
  apicize-tools docs --type ai

Documentation exported:
  • AI_ASSISTANT_GUIDE.md - Complete guide for AI assistants (LLMs)
    - LLM-friendly features (--llm-friendly, --auto-fix)
    - Common workflows and patterns
    - Code examples and templates
    - Best practices for file generation`)
    .option('-o, --output <path>', 'output directory for documentation files (default: current directory)', '.')
    .option('-t, --type <type>', 'documentation type: "ai" for AI guide only, "all" for everything (default: all)', 'all')
    .action(async (options) => {
      try {
        const outputDir = resolve(options.output);
        const docType = options.type.toLowerCase();

        console.log(chalk.blue('📚 Exporting Apicize documentation...'));
        console.log(chalk.gray(`Output directory: ${outputDir}`));

        // Read the AI Assistant Guide from the @jstormes/apicize-lib package
        const libPackagePath = require.resolve('@jstormes/apicize-lib');
        const libRoot = join(libPackagePath, '../../'); // Go up from dist/index.js to package root
        const guideSource = join(libRoot, 'docs/AI_ASSISTANT_GUIDE.md');
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
