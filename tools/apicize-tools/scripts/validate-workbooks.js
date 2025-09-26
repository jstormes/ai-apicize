#!/usr/bin/env node

/**
 * Standard workbook validation script for BUILD_PLAN.md steps
 * This script validates all example workbooks to ensure compatibility throughout development
 */

const fs = require('fs');
const path = require('path');

// Check if we're in the right directory
const currentDir = process.cwd();
if (!currentDir.includes('apicize-tools')) {
  console.error('❌ Error: This script must be run from the apicize-tools directory');
  process.exit(1);
}

// Try to load the validation library
let validateApicizeFile;
try {
  const validatorPath = path.resolve('./packages/lib/dist/validation/validator.js');
  if (!fs.existsSync(validatorPath)) {
    console.error('❌ Error: Validation library not built. Run `npm run build` first.');
    console.error(`   Looking for: ${validatorPath}`);
    process.exit(1);
  }
  ({ validateApicizeFile } = require(validatorPath));
} catch (error) {
  console.error('❌ Error: Cannot load validation library:', error.message);
  console.error('   Make sure the lib package is built with `npm run build`');
  process.exit(1);
}

async function validateAllWorkbooks() {
  console.log('🔍 Validating All Sample Workbooks\n');

  const workbooksDir = './packages/examples/workbooks';
  if (!fs.existsSync(workbooksDir)) {
    console.error('❌ Error: Examples directory not found. Make sure examples are installed.');
    process.exit(1);
  }

  const workbookFiles = fs.readdirSync(workbooksDir).filter(f => f.endsWith('.apicize'));

  if (workbookFiles.length === 0) {
    console.error('❌ Error: No .apicize files found in examples directory.');
    process.exit(1);
  }

  let validFiles = 0;
  let totalFiles = workbookFiles.length;
  const errors = [];

  console.log(`Found ${totalFiles} workbook files to validate:\n`);

  for (const filename of workbookFiles) {
    const filepath = path.join(workbooksDir, filename);

    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const data = JSON.parse(content);
      const result = validateApicizeFile(data);

      if (result.valid) {
        console.log(`✅ ${filename}`);
        validFiles++;
      } else {
        console.log(`❌ ${filename} - ${result.errors.length} errors`);
        errors.push({
          file: filename,
          errors: result.errors
        });
      }
    } catch (error) {
      console.log(`💥 ${filename} - Parse error: ${error.message}`);
      errors.push({
        file: filename,
        errors: [{ message: `Parse error: ${error.message}` }]
      });
    }
  }

  console.log('\n📊 VALIDATION SUMMARY');
  console.log('═'.repeat(50));
  console.log(`Valid workbooks: ${validFiles}/${totalFiles} (${Math.round(validFiles/totalFiles*100)}%)`);

  if (errors.length > 0) {
    console.log('\n❌ VALIDATION ERRORS:');
    errors.forEach(({ file, errors: fileErrors }) => {
      console.log(`\n${file}:`);
      fileErrors.slice(0, 5).forEach((error, i) => {
        console.log(`  ${i + 1}. ${error.message}`);
      });
      if (fileErrors.length > 5) {
        console.log(`  ... and ${fileErrors.length - 5} more errors`);
      }
    });

    console.log('\n🔧 Action Required:');
    console.log('Some workbooks are failing validation. This may indicate:');
    console.log('1. Schema changes broke compatibility with existing files');
    console.log('2. New validation rules are too strict');
    console.log('3. Example files need to be updated');
    console.log('\nFix validation errors before proceeding to the next step.');

    process.exit(1);
  }

  console.log('\n🎉 All workbooks validate successfully!');
  console.log('The changes in this step maintain compatibility with existing .apicize files.');
  process.exit(0);
}

// Add some helpful usage info
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Apicize Workbook Validation Script');
  console.log('');
  console.log('Usage: node scripts/validate-workbooks.js');
  console.log('');
  console.log('This script validates all example .apicize workbooks to ensure');
  console.log('compatibility is maintained throughout development.');
  console.log('');
  console.log('Prerequisites:');
  console.log('  - Run from apicize-tools directory');
  console.log('  - Run `npm run build` first to build the validation library');
  console.log('');
  console.log('Exit codes:');
  console.log('  0 - All workbooks validate successfully');
  console.log('  1 - Some workbooks failed validation or setup error');
  process.exit(0);
}

validateAllWorkbooks().catch(console.error);