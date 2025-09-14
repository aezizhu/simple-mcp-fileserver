/**
 * Global Test Setup
 *
 * Setup executed once before all test suites.
 * Prepares test environment and resources.
 *
 * @author aezizhu
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('🚀 Setting up MCP FileBridge test environment...');

  // Create test directories
  const testDirs = [
    'tests/fixtures',
    'tests/temp',
    'tests/results',
    'logs',
    'temp'
  ];

  for (const dir of testDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.warn(`⚠️  Failed to create directory ${dir}:`, error.message);
      }
    }
  }

  // Create test fixtures
  await createTestFixtures();

  // Set up environment variables
  process.env.NODE_ENV = 'test';
  process.env.TEST_MODE = 'true';

  console.log('✅ Global test setup completed');
};

/**
 * Create test fixture files
 */
async function createTestFixtures() {
  const fixtures = [
    {
      path: 'tests/fixtures/test.txt',
      content: 'This is a test file for MCP FileBridge.\nIt contains multiple lines of text.\nUsed for integration testing.'
    },
    {
      path: 'tests/fixtures/test.json',
      content: JSON.stringify({
        name: 'MCP FileBridge',
        version: '1.0.0',
        description: 'Test fixture file',
        data: [1, 2, 3, 4, 5]
      }, null, 2)
    },
    {
      path: 'tests/fixtures/test.js',
      content: `/**
 * Test JavaScript file
 */
function testFunction() {
  console.log('Hello from test fixture');
  return 'test result';
}

module.exports = { testFunction };
`
    },
    {
      path: 'tests/fixtures/large-file.txt',
      content: 'A'.repeat(100000) // 100KB file
    }
  ];

  for (const fixture of fixtures) {
    try {
      await fs.writeFile(fixture.path, fixture.content, 'utf8');
      console.log(`📄 Created fixture: ${fixture.path}`);
    } catch (error) {
      console.warn(`⚠️  Failed to create fixture ${fixture.path}:`, error.message);
    }
  }

  // Create a simple test image
  try {
    const sharp = require('sharp');
    const imageBuffer = await sharp({
      create: {
        width: 200,
        height: 150,
        channels: 3,
        background: { r: 255, g: 100, b: 50 }
      }
    })
    .jpeg({ quality: 85 })
    .toBuffer();

    await fs.writeFile('tests/fixtures/test.jpg', imageBuffer);
    console.log('🖼️  Created test image: tests/fixtures/test.jpg');
  } catch (error) {
    console.warn('⚠️  Failed to create test image:', error.message);
  }
}
