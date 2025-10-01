#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { validateApicizeFile } = require('./packages/lib/dist/validation/validator');
const { ApicizeParser } = require('./packages/lib/dist/parser/apicize-parser');
const { VariableEngine } = require('./packages/lib/dist/variables/variable-engine');
const { AuthManager } = require('./packages/lib/dist/auth/auth-manager');

console.log('🚀 Testing Apicize Workbooks with Current Code\n');

const workbooksDir = path.join(__dirname, 'packages/examples/workbooks');
const workbookFiles = fs.readdirSync(workbooksDir)
  .filter(f => f.endsWith('.apicize'))
  .sort();

async function testWorkbook(filename) {
  console.log(`\n📘 Testing: ${filename}`);
  console.log('═'.repeat(50));

  const filepath = path.join(workbooksDir, filename);
  const content = fs.readFileSync(filepath, 'utf8');
  const workbook = JSON.parse(content);

  // 1. Validation
  const validationResult = validateApicizeFile(workbook);
  console.log(`✅ Validation: ${validationResult.valid ? 'PASSED' : 'FAILED'}`);
  if (!validationResult.valid) {
    console.log('  Errors:', validationResult.errors?.slice(0, 3));
  }

  // 2. Parse structure
  const parser = new ApicizeParser();
  const stats = {
    requests: 0,
    groups: 0,
    scenarios: workbook.scenarios?.length || 0,
    authorizations: workbook.authorizations?.length || 0,
    hasTests: false
  };

  function countRequests(items) {
    if (!items) return;
    for (const item of items) {
      if (item.children) {
        stats.groups++;
        countRequests(item.children);
      } else if (item.url) {
        stats.requests++;
        if (item.test) stats.hasTests = true;
      }
    }
  }

  countRequests(workbook.requests);

  console.log(`📊 Structure:`);
  console.log(`  - Requests: ${stats.requests}`);
  console.log(`  - Groups: ${stats.groups}`);
  console.log(`  - Scenarios: ${stats.scenarios}`);
  console.log(`  - Auth configs: ${stats.authorizations}`);
  console.log(`  - Has tests: ${stats.hasTests ? 'Yes' : 'No'}`);

  // 3. Variable Engine test
  if (workbook.scenarios?.length > 0) {
    const scenario = workbook.scenarios[0];
    console.log(`\n🔧 Testing Variable Engine with scenario: "${scenario.name}"`);

    const variableEngine = new VariableEngine();
    variableEngine.setScenario(scenario);

    // Test substitution
    const testUrl = 'https://api.example.com/users/{{userId}}';
    const substituted = variableEngine.substitute(testUrl);
    console.log(`  Original: ${testUrl}`);
    console.log(`  Substituted: ${substituted}`);

    // Show available variables
    const varCount = scenario.variables?.length || 0;
    if (varCount > 0) {
      console.log(`  Available variables: ${varCount}`);
      scenario.variables.slice(0, 3).forEach(v => {
        console.log(`    - ${v.name}: ${JSON.stringify(v.value).substring(0, 50)}...`);
      });
    }
  }

  // 4. Authentication test
  if (workbook.authorizations?.length > 0) {
    console.log(`\n🔐 Testing Authentication Manager`);
    const authManager = new AuthManager();

    for (const authConfig of workbook.authorizations.slice(0, 2)) {
      try {
        authManager.addProvider(authConfig.id, authConfig);
        console.log(`  ✅ Loaded: ${authConfig.name} (${authConfig.type})`);
      } catch (error) {
        console.log(`  ❌ Failed to load: ${authConfig.name} - ${error.message}`);
      }
    }
  }

  // 5. Find and display a sample request
  function findFirstRequest(items) {
    if (!items) return null;
    for (const item of items) {
      if (item.url) return item;
      if (item.children) {
        const found = findFirstRequest(item.children);
        if (found) return found;
      }
    }
    return null;
  }

  const sampleRequest = findFirstRequest(workbook.requests);
  if (sampleRequest) {
    console.log(`\n📝 Sample Request:`);
    console.log(`  Name: ${sampleRequest.name}`);
    console.log(`  Method: ${sampleRequest.method}`);
    console.log(`  URL: ${sampleRequest.url}`);
    if (sampleRequest.test) {
      const testPreview = sampleRequest.test.substring(0, 100).replace(/\n/g, ' ');
      console.log(`  Test: ${testPreview}...`);
    }
  }
}

async function runTests() {
  console.log(`Found ${workbookFiles.length} workbook files to test\n`);

  for (const file of workbookFiles) {
    try {
      await testWorkbook(file);
    } catch (error) {
      console.log(`\n❌ Error testing ${file}: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log('✅ All workbook tests completed!');
}

runTests().catch(console.error);