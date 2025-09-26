const fs = require('fs');
const path = require('path');
const { validateApicizeFile } = require('./packages/lib/dist/validation/validator');

async function testExampleValidation() {
  console.log('Testing example validation...\n');

  const testFiles = [
    { file: 'packages/examples/workbooks/demo.apicize', expectedValid: true },
    { file: 'packages/examples/workbooks/minimal.apicize', expectedValid: true },
    { file: 'packages/examples/workbooks/simple-rest-api.apicize', expectedValid: true },
    { file: 'packages/examples/workbooks/with-authentication.apicize', expectedValid: true },
    { file: 'packages/examples/workbooks/request-groups.apicize', expectedValid: true },
    { file: 'packages/examples/test-cases/valid-all-body-types.apicize', expectedValid: true },
    { file: 'packages/examples/test-cases/invalid-missing-version.apicize', expectedValid: false },
    { file: 'packages/examples/test-cases/invalid-wrong-method.apicize', expectedValid: false }
  ];

  let passedTests = 0;
  let totalTests = testFiles.length;

  for (const test of testFiles) {
    try {
      const content = fs.readFileSync(test.file, 'utf-8');
      const data = JSON.parse(content);
      const result = validateApicizeFile(data);

      const testPassed = result.valid === test.expectedValid;
      const status = testPassed ? '✅' : '❌';
      const expectation = test.expectedValid ? 'valid' : 'invalid';

      console.log(`${status} ${path.basename(test.file)} - Expected ${expectation}, got ${result.valid ? 'valid' : 'invalid'}`);

      if (!testPassed) {
        console.log(`   Expected: ${expectation}`);
        console.log(`   Actual: ${result.valid ? 'valid' : 'invalid'}`);
        if (result.errors.length > 0) {
          console.log(`   Errors: ${result.errors.length}`);
          result.errors.slice(0, 3).forEach((error, i) => {
            console.log(`     ${i + 1}. ${error.message}`);
          });
        }
      }

      if (testPassed) passedTests++;
    } catch (error) {
      console.log(`❌ ${path.basename(test.file)} - Failed to load: ${error.message}`);
    }
  }

  console.log(`\n📊 Validation Test Results:`);
  console.log(`  Passed: ${passedTests}/${totalTests}`);
  console.log(`  Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

  if (passedTests === totalTests) {
    console.log('\n🎉 All validation tests passed!');
  } else {
    console.log('\n⚠️ Some validation tests failed. Check the schema or examples.');
  }
}

testExampleValidation().catch(console.error);