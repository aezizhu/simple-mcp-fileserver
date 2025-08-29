# Visual AI Setup Guide

This guide shows you how to set up the visual AI functionality in the MCP fileserver to enable real image understanding.

## 🎯 The Solution

Previously, the MCP fileserver could only transfer image data but couldn't truly "understand" what was in the images. Now we've added a `visualDescribe` method that uses external vision AI models to actually analyze and describe image content.

## 🔧 Quick Setup

### 1. Get a Vision API Key

Choose one of these providers:

#### OpenAI GPT-4 Vision (Recommended)
```bash
# Get your API key from https://platform.openai.com/api-keys
export VISION_API_KEY="sk-your-openai-api-key-here"
export VISION_PROVIDER="openai"
export VISION_MODEL="gpt-4-vision-preview"
```

#### Anthropic Claude Vision
```bash
# Get your API key from https://console.anthropic.com/
export VISION_API_KEY="sk-ant-your-anthropic-key-here"
export VISION_PROVIDER="claude"
export VISION_MODEL="claude-3-sonnet-20240229"
```

#### Google Gemini Vision
```bash
# Get your API key from https://aistudio.google.com/app/apikey
export VISION_API_KEY="your-gemini-api-key-here"
export VISION_PROVIDER="gemini"
export VISION_MODEL="gemini-pro-vision"
```

### 2. Start the Server

```bash
# With environment variables
PORT=8095 node simple-mcp-fileserver.js

# Or export them first
export VISION_API_KEY="your-key"
export VISION_PROVIDER="openai"
PORT=8095 node simple-mcp-fileserver.js
```

### 3. Test Visual Description

```bash
# Test with our test script
node test-vision.js /path/to/your/image.jpg

# Or test manually with curl
curl -s -X POST http://localhost:8095/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "method": "visualDescribe",
  "params": {
    "path": "/absolute/path/to/your/image.jpg",
    "format": "simple",
    "prompt": "What animals do you see in this image?"
  },
  "id": 1
}' | jq '.result.content'
```

## 💡 How It Works

### The Problem We Solved
Before this update:
- ❌ LLMs could receive image data but couldn't "see" the content
- ❌ Images were just transferred as binary data
- ❌ No real visual understanding or description

### Our Solution
Now with `visualDescribe`:
- ✅ **Real visual understanding**: Uses vision AI models to analyze images
- ✅ **Flexible prompts**: Ask specific questions about the image
- ✅ **Multiple providers**: Support for OpenAI, Claude, and Gemini
- ✅ **Two output formats**: Simple text or detailed with image data

### Method Comparison

| Method | Purpose | Output |
|--------|---------|--------|
| `readFile` | Transfer image data | Base64, dataURL, or multimodal object |
| `visualDescribe` | Understand image content | Text description of what's in the image |

## 🚀 Usage Examples

### Basic Animal Detection
```json
{
  "method": "visualDescribe",
  "params": {
    "path": "/path/to/animal.jpg",
    "prompt": "What animals do you see in this image?"
  }
}
```

Response:
```json
{
  "result": {
    "content": "I can see a majestic lion standing on the savannah...",
    "encoding": "text",
    "mimeType": "text/plain"
  }
}
```

### Detailed Analysis
```json
{
  "method": "visualDescribe",
  "params": {
    "path": "/path/to/scene.jpg",
    "format": "detailed",
    "prompt": "Describe this scene including colors, objects, and any people or animals"
  }
}
```

Response includes both description and original image data.

## 🛠️ Configuration Options

### Environment Variables
- `VISION_API_KEY`: Your vision API key (required)
- `VISION_PROVIDER`: Provider name (`openai`, `claude`, `gemini`)
- `VISION_MODEL`: Specific model name
- `VISION_API_ENDPOINT`: Custom endpoint (optional)

### Request Parameters
- `path`: Image file path (required)
- `format`: Output format (`simple` or `detailed`)
- `prompt`: Custom analysis prompt

## 🧪 Testing

The server includes comprehensive tests:

```bash
# Run all vision tests
node test-vision.js

# Test specific image
node test-vision.js /path/to/your/image.jpg

# Test with different providers
VISION_PROVIDER=claude node test-vision.js
VISION_PROVIDER=gemini node test-vision.js
```

## 🔍 Troubleshooting

### Common Issues

1. **"Vision API not configured"**
   - Set the `VISION_API_KEY` environment variable
   - Restart the server after setting the key

2. **"Unsupported vision provider"**
   - Check `VISION_PROVIDER` is one of: `openai`, `claude`, `gemini`
   - Default is `openai` if not specified

3. **"File is not an image"**
   - Ensure the file is a valid image format (JPG, PNG, GIF, WebP)
   - Check the file path is correct

4. **API Error Messages**
   - Check your API key is valid and has sufficient credits
   - Verify network connectivity to the API endpoint

### Test Without API Key
The server gracefully handles missing API keys:
```bash
# This will work but return an error message
curl -s -X POST http://localhost:8095/mcp -d '{
  "jsonrpc": "2.0",
  "method": "visualDescribe",
  "params": {"path": "/path/to/image.jpg"},
  "id": 1
}' | jq '.result.content'
# Returns: "Vision API not configured. Please set VISION_API_KEY environment variable."
```

## 🎉 Success Metrics

You'll know it's working when:
- ✅ `visualDescribe` appears in server capabilities
- ✅ Test script shows vision capability detected
- ✅ API calls return actual image descriptions instead of error messages
- ✅ LLMs can now truly "understand" image content through your MCP server

This solves the original problem where LLMs could only see image data as binary but couldn't understand the visual content!
