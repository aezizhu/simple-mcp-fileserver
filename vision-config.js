// Vision API Configuration Examples
// Copy and modify these settings for your environment

const VISION_CONFIGS = {
  // OpenAI GPT-4 Vision
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4-vision-preview',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    })
  },

  // Anthropic Claude Vision
  claude: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-sonnet-20240229',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    })
  },

  // Google Gemini Vision
  gemini: {
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-pro-vision:generateContent',
    model: 'gemini-pro-vision',
    headers: (apiKey) => ({
      'Content-Type': 'application/json'
    }),
    buildRequest: (base64Image, mimeType, prompt, apiKey) => ({
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image
            }
          }
        ]
      }]
    })
  }
};

module.exports = VISION_CONFIGS;
