#!/usr/bin/env node

/**
 * MCP Fileserver Vision Test Script
 *
 * This script demonstrates the visual description functionality of the MCP fileserver.
 * It tests the visualDescribe method with different configurations.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
const SERVER_PORT = process.env.SERVER_PORT || '8095';

// Test image path
const TEST_IMAGE_PATH = process.argv[2] || './animal_test_image.jpg';

async function makeMCPRequest(method, params = {}) {
  const payload = {
    jsonrpc: '2.0',
    method: method,
    params: params,
    id: Date.now()
  };

  return new Promise((resolve, reject) => {
    const options = {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MCP-Format': 'simple',
        'X-Client': 'vision-test'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function testInitialize() {
  console.log('🔍 Testing MCP initialize...');
  try {
    const response = await makeMCPRequest('initialize');
    console.log('✅ Initialize successful');
    console.log('📋 Supported capabilities:', Object.keys(response.result.capabilities));
    if (response.result.capabilities.visualDescribe) {
      console.log('🎯 Visual description capability detected!');
    }
    return response;
  } catch (error) {
    console.error('❌ Initialize failed:', error.message);
    return null;
  }
}

async function testVisualDescribe(imagePath, format = 'simple', customPrompt = null) {
  console.log(`\n🖼️ Testing visual description for: ${imagePath}`);

  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Test image not found: ${imagePath}`);
    console.log('💡 Please provide a valid image path or run:');
    console.log('   curl -s "https://picsum.photos/512" -o test_image.jpg');
    return null;
  }

  const absolutePath = path.resolve(imagePath);
  console.log(`📂 Using absolute path: ${absolutePath}`);

  const params = {
    path: absolutePath,
    format: format
  };

  if (customPrompt) {
    params.prompt = customPrompt;
  }

  try {
    const response = await makeMCPRequest('visualDescribe', params);

    if (response.error) {
      console.error('❌ Visual description failed:', response.error.message);
      return null;
    }

    console.log('✅ Visual description successful!');
    console.log('📝 Description:');
    console.log('---');

    if (format === 'detailed') {
      console.log(response.result.description);
      console.log('---');
      console.log(`🖼️ Image info: ${response.result.imageData.mimeType}, ${response.result.imageData.byteLength} bytes`);
    } else {
      console.log(response.result.content);
    }

    console.log('---');
    return response;

  } catch (error) {
    console.error('❌ Visual description request failed:', error.message);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting MCP Fileserver Vision Tests\n');

  // Check if server is running
  console.log(`🌐 Testing connection to ${SERVER_HOST}:${SERVER_PORT}...`);

  try {
    await makeMCPRequest('initialize');
  } catch (error) {
    console.error(`❌ Cannot connect to server at ${SERVER_HOST}:${SERVER_PORT}`);
    console.log('💡 Make sure the server is running:');
    console.log('   PORT=8095 node simple-mcp-fileserver.js');
    process.exit(1);
  }

  // Test initialize
  await testInitialize();

  // Test visual description with different prompts
  const testPrompts = [
    null, // Default prompt
    "What animals do you see in this image? Describe them in detail.",
    "Please identify any wildlife or animals visible in this photograph."
  ];

  for (let i = 0; i < testPrompts.length; i++) {
    const prompt = testPrompts[i];
    const promptLabel = prompt ? `"${prompt.substring(0, 30)}..."` : 'default prompt';
    console.log(`\n🔬 Test ${i + 1}: ${promptLabel}`);

    await testVisualDescribe(TEST_IMAGE_PATH, 'simple', prompt);
  }

  // Test detailed format
  console.log('\n🔬 Test with detailed format:');
  await testVisualDescribe(TEST_IMAGE_PATH, 'detailed');

  console.log('\n🎉 All vision tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  makeMCPRequest,
  testInitialize,
  testVisualDescribe,
  runTests
};
