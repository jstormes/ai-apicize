const fs = require('fs');
const path = require('path');

// Test loading example files
async function testExamples() {
  console.log('Testing example files...\n');

  const examplesDir = './packages/examples';

  // Test workbooks directory
  console.log('📁 Workbooks:');
  const workbooksDir = path.join(examplesDir, 'workbooks');
  const workbooks = fs.readdirSync(workbooksDir);
  workbooks.forEach(file => {
    if (file.endsWith('.apicize')) {
      try {
        const content = fs.readFileSync(path.join(workbooksDir, file), 'utf-8');
        const data = JSON.parse(content);
        console.log(`  ✅ ${file} (version: ${data.version})`);
      } catch (error) {
        console.log(`  ❌ ${file} - Error: ${error.message}`);
      }
    }
  });

  // Test data directory
  console.log('\n📁 Data files:');
  const dataDir = path.join(examplesDir, 'data');
  const dataFiles = fs.readdirSync(dataDir);
  dataFiles.forEach(file => {
    try {
      const stats = fs.statSync(path.join(dataDir, file));
      console.log(`  ✅ ${file} (${stats.size} bytes)`);
    } catch (error) {
      console.log(`  ❌ ${file} - Error: ${error.message}`);
    }
  });

  // Test test-cases directory
  console.log('\n📁 Test cases:');
  const testCasesDir = path.join(examplesDir, 'test-cases');
  const testCases = fs.readdirSync(testCasesDir);
  testCases.forEach(file => {
    if (file.endsWith('.apicize')) {
      try {
        const content = fs.readFileSync(path.join(testCasesDir, file), 'utf-8');
        const data = JSON.parse(content);
        const isValid = file.startsWith('valid-');
        console.log(`  ${isValid ? '✅' : '⚠️'} ${file} (expected ${isValid ? 'valid' : 'invalid'})`);
      } catch (error) {
        console.log(`  ❌ ${file} - Error: ${error.message}`);
      }
    }
  });

  console.log('\n📊 Summary:');
  console.log(`  Workbooks: ${workbooks.filter(f => f.endsWith('.apicize')).length} files`);
  console.log(`  Data files: ${dataFiles.length} files`);
  console.log(`  Test cases: ${testCases.filter(f => f.endsWith('.apicize')).length} files`);
  console.log(`  Total examples: ${workbooks.length + dataFiles.length + testCases.length} files`);
}

testExamples().catch(console.error);