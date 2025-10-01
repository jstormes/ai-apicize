const fs = require('fs');
const path = require('path');

// Import the built validation functions
const { ApicizeValidator, validateApicizeFile } = require('./packages/lib/dist/validation/validator');

async function testValidation() {
  console.log('Testing Apicize validation...\n');

  // Test 1: Basic valid file
  console.log('Test 1: Basic valid file');
  const basicValid = {
    version: 1.0
  };

  const result1 = validateApicizeFile(basicValid);
  console.log('Valid:', result1.valid);
  console.log('Errors:', result1.errors.length);
  console.log('');

  // Test 2: Invalid file
  console.log('Test 2: Invalid file (missing version)');
  const invalid = {
    requests: []
  };

  const result2 = validateApicizeFile(invalid);
  console.log('Valid:', result2.valid);
  console.log('Errors:', result2.errors.length);
  if (result2.errors.length > 0) {
    console.log('First error:', result2.errors[0].message);
  }
  console.log('');

  // Test 3: Demo file validation
  console.log('Test 3: Demo file validation');
  const demoPath = path.join(__dirname, '../../app/app/src-tauri/help/demo/demo.apicize');

  if (fs.existsSync(demoPath)) {
    try {
      const demoContent = fs.readFileSync(demoPath, 'utf-8');
      const demoData = JSON.parse(demoContent);

      const result3 = validateApicizeFile(demoData);
      console.log('Demo file valid:', result3.valid);
      console.log('Demo file errors:', result3.errors.length);

      if (!result3.valid) {
        console.log('Validation errors:');
        result3.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error.message}`);
        });
      }
    } catch (error) {
      console.log('Error reading/parsing demo file:', error.message);
    }
  } else {
    console.log('Demo file not found at:', demoPath);
  }

  console.log('\nValidation test completed!');
}

testValidation().catch(console.error);