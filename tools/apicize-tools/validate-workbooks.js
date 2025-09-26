const fs = require('fs');
const path = require('path');
const { validateApicizeFile } = require('./packages/lib/dist/validation/validator');

async function validateWorkbooks() {
  console.log('🔍 Validating Workbook Files\n');

  const workbooksDir = './packages/examples/workbooks';
  const workbookFiles = fs.readdirSync(workbooksDir).filter(f => f.endsWith('.apicize'));

  let validFiles = 0;
  let totalFiles = workbookFiles.length;
  const allErrors = new Map();

  for (const filename of workbookFiles) {
    const filepath = path.join(workbooksDir, filename);

    console.log(`📄 ${filename}`);
    console.log('═'.repeat(50));

    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const data = JSON.parse(content);
      const result = validateApicizeFile(data);

      if (result.valid) {
        console.log('✅ VALID - No validation errors\n');
        validFiles++;
      } else {
        console.log(`❌ INVALID - ${result.errors.length} validation errors:`);

        // Group errors by type for analysis
        const errorsByType = {};
        result.errors.forEach((error, index) => {
          const errorType = error.keyword;
          if (!errorsByType[errorType]) {
            errorsByType[errorType] = [];
          }
          errorsByType[errorType].push(error);

          console.log(`  ${index + 1}. [${error.keyword}] ${error.message}`);
          console.log(`     Path: ${error.path}`);
        });

        // Store errors for global analysis
        allErrors.set(filename, {
          total: result.errors.length,
          byType: errorsByType,
          errors: result.errors
        });

        console.log('');
      }
    } catch (error) {
      console.log(`💥 FAILED TO PARSE: ${error.message}\n`);
    }
  }

  console.log('📊 VALIDATION SUMMARY');
  console.log('═'.repeat(50));
  console.log(`Valid files: ${validFiles}/${totalFiles} (${Math.round(validFiles/totalFiles*100)}%)`);
  console.log(`Invalid files: ${totalFiles - validFiles}/${totalFiles}`);

  if (allErrors.size > 0) {
    console.log('\n🔍 ERROR ANALYSIS');
    console.log('═'.repeat(50));

    // Analyze error patterns
    const globalErrorTypes = {};
    const globalErrorPaths = {};

    allErrors.forEach((fileErrors, filename) => {
      Object.entries(fileErrors.byType).forEach(([errorType, errors]) => {
        if (!globalErrorTypes[errorType]) {
          globalErrorTypes[errorType] = { count: 0, files: [] };
        }
        globalErrorTypes[errorType].count += errors.length;
        globalErrorTypes[errorType].files.push(filename);
      });

      fileErrors.errors.forEach(error => {
        const pathKey = error.path || 'root';
        if (!globalErrorPaths[pathKey]) {
          globalErrorPaths[pathKey] = { count: 0, messages: new Set() };
        }
        globalErrorPaths[pathKey].count++;
        globalErrorPaths[pathKey].messages.add(error.message);
      });
    });

    console.log('Most common error types:');
    Object.entries(globalErrorTypes)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 5)
      .forEach(([type, info]) => {
        console.log(`  ${type}: ${info.count} occurrences in ${info.files.length} files`);
      });

    console.log('\nMost problematic paths:');
    Object.entries(globalErrorPaths)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 5)
      .forEach(([path, info]) => {
        console.log(`  ${path}: ${info.count} errors`);
        Array.from(info.messages).slice(0, 2).forEach(msg => {
          console.log(`    - ${msg}`);
        });
      });

    console.log('\n🔧 RECOMMENDED FIXES');
    console.log('═'.repeat(50));

    if (globalErrorTypes['required']) {
      console.log('1. Missing required properties - Update schema to make some fields optional');
    }
    if (globalErrorTypes['additionalProperties']) {
      console.log('2. Unknown properties - Add missing properties to schema definitions');
    }
    if (globalErrorTypes['pattern']) {
      console.log('3. Pattern mismatches - Relax ID patterns or fix data format');
    }
    if (globalErrorTypes['oneOf']) {
      console.log('4. OneOf validation failures - Fix request/group discrimination logic');
    }
  }

  console.log('\n🎯 NEXT STEPS');
  console.log('═'.repeat(50));
  console.log('1. Examine the most common error patterns above');
  console.log('2. Update the JSON schema to match actual .apicize file structure');
  console.log('3. Re-run validation to verify fixes');
  console.log('4. Update any synthetic examples that have issues');
}

validateWorkbooks().catch(console.error);