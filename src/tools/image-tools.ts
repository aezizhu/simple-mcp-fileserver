/**
 * Image Analysis Tools
 * 
 * Professional image processing tools that provide accurate technical analysis
 * without hallucination. Designed for enterprise MCP environments.
 * 
 * @author aezizhu
 * @version 1.0.0
 */

import { readFile, stat, access, constants } from 'fs/promises';
import { extname, basename } from 'path';
import sharp from 'sharp';
import { createWorker, Worker } from 'tesseract.js';
import exifr from 'exifr';
import mime from 'mime-types';
import axios from 'axios';
import { 
  Tool, 
  Content, 
  ContentType, 
  ImageAnalysisOptions, 
  ImageAnalysisResult,
  ImageMetadata,
  TextBlock,
  Logger 
} from '@/types/mcp';

export class ImageAnalysisTools {
  private ocrWorker?: Worker;
  private readonly logger: Logger;
  private readonly supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'];
  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeOCR();
  }

  /**
   * Initialize OCR worker
   */
  private async initializeOCR(): Promise<void> {
    try {
      this.logger.info('Initializing OCR worker...');
      this.ocrWorker = await createWorker('eng');
      this.logger.info('OCR worker initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OCR worker', error as Error);
    }
  }

  /**
   * Get all image analysis tools
   */
  public getTools(): Tool[] {
    return [
      {
        name: 'analyze_image',
        description: 'Analyze image file and extract technical metadata without content assumptions',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the image file to analyze'
            },
            include_ocr: {
              type: 'boolean',
              default: false,
              description: 'Extract text using OCR (Optical Character Recognition)'
            },
            include_exif: {
              type: 'boolean',
              default: true,
              description: 'Include EXIF metadata from the image'
            },
            return_base64: {
              type: 'boolean',
              default: false,
              description: 'Return base64 encoded image for LLM vision analysis'
            },
            max_dimension: {
              type: 'number',
              default: 2048,
              minimum: 256,
              maximum: 4096,
              description: 'Maximum width/height for base64 output (for optimization)'
            },
            quality: {
              type: 'number',
              default: 85,
              minimum: 1,
              maximum: 100,
              description: 'JPEG quality for base64 output (1-100)'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'download_image',
        description: 'Download an image from URL for analysis',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              format: 'uri',
              description: 'Image URL to download'
            },
            save_path: {
              type: 'string',
              description: 'Optional local path to save the image (auto-generated if not provided)'
            },
            timeout: {
              type: 'number',
              default: 30000,
              minimum: 5000,
              maximum: 120000,
              description: 'Download timeout in milliseconds'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'extract_image_text',
        description: 'Extract text from image using OCR with detailed positioning',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the image file'
            },
            language: {
              type: 'string',
              default: 'eng',
              description: 'OCR language code (eng, chi_sim, fra, etc.)'
            },
            include_blocks: {
              type: 'boolean',
              default: false,
              description: 'Include detailed text block positioning information'
            }
          },
          required: ['path']
        }
      }
    ];
  }

  /**
   * Execute image analysis tool
   */
  public async executeAnalyzeImage(args: {
    path: string;
    include_ocr?: boolean;
    include_exif?: boolean;
    return_base64?: boolean;
    max_dimension?: number;
    quality?: number;
  }): Promise<{ content: Content[] }> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting image analysis', { path: args.path });
      
      // Validate and prepare options
      const options: ImageAnalysisOptions = {
        includeOcr: args.include_ocr || false,
        includeExif: args.include_exif !== false, // Default true
        returnBase64: args.return_base64 || false,
        maxDimension: args.max_dimension || 2048,
        quality: args.quality || 85,
      };

      // Perform analysis
      const result = await this.analyzeImage(args.path, options);
      
      const duration = Date.now() - startTime;
      this.logger.info('Image analysis completed', { 
        path: args.path, 
        duration: `${duration}ms`,
        hasOcr: !!result.ocrResults,
        hasBase64: !!result.base64Data
      });

      return {
        content: [{
          type: ContentType.TEXT,
          text: this.formatAnalysisResult(result)
        }]
      };

    } catch (error) {
      this.logger.error('Image analysis failed', error as Error, { path: args.path });
      throw error;
    }
  }

  /**
   * Execute download image tool
   */
  public async executeDownloadImage(args: {
    url: string;
    save_path?: string;
    timeout?: number;
  }): Promise<{ content: Content[] }> {
    try {
      this.logger.info('Downloading image', { url: args.url });
      
      const response = await axios.get(args.url, {
        responseType: 'arraybuffer',
        timeout: args.timeout || 30000,
        maxContentLength: this.maxFileSize,
        headers: {
          'User-Agent': 'MCP-Enterprise-Server/1.0.0 (Image Downloader)'
        }
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      
      // Determine file extension
      const ext = mime.extension(contentType) || 'bin';
      const filename = args.save_path || `downloaded_image_${Date.now()}.${ext}`;
      
      // Save file
      const fs = await import('fs/promises');
      await fs.writeFile(filename, buffer);
      
      // Basic validation
      if (!this.supportedFormats.includes(`.${ext}`)) {
        this.logger.warn('Downloaded file may not be a supported image format', { 
          contentType, 
          extension: ext 
        });
      }

      this.logger.info('Image downloaded successfully', { 
        url: args.url, 
        filename, 
        size: buffer.length 
      });

      return {
        content: [{
          type: ContentType.TEXT,
          text: `Image downloaded successfully\n\nDetails:\n- URL: ${args.url}\n- Saved to: ${filename}\n- Size: ${buffer.length} bytes\n- Content-Type: ${contentType}\n- Extension: .${ext}\n\nUse the analyze_image tool to analyze the downloaded image:\n\`\`\`json\n{\n  "name": "analyze_image",\n  "arguments": {\n    "path": "${filename}",\n    "return_base64": true,\n    "include_ocr": true\n  }\n}\n\`\`\``
        }]
      };

    } catch (error) {
      this.logger.error('Image download failed', error as Error, { url: args.url });
      throw new Error(`Download failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute extract image text tool
   */
  public async executeExtractImageText(args: {
    path: string;
    language?: string;
    include_blocks?: boolean;
  }): Promise<{ content: Content[] }> {
    try {
      this.logger.info('Extracting text from image', { path: args.path });
      
      if (!this.ocrWorker) {
        throw new Error('OCR worker not initialized');
      }

      // Validate file
      await this.validateImageFile(args.path);
      
      // Read and process image
      const imageBuffer = await readFile(args.path);
      
      // Set language if specified
      const language = args.language || 'eng';
      await this.ocrWorker.setParameters({
        tessedit_char_whitelist: undefined, // Allow all characters
        tessedit_pageseg_mode: '1', // Automatic page segmentation
      });

      // Perform OCR
      const { data } = await this.ocrWorker.recognize(imageBuffer, { lang: language });
      
      const result = {
        extracted_text: data.text.trim() || 'No text detected',
        confidence: Math.round(data.confidence),
        language: language,
        word_count: data.words?.length || 0,
        blocks: args.include_blocks ? this.processTextBlocks(data) : undefined
      };

      this.logger.info('Text extraction completed', { 
        path: args.path,
        confidence: result.confidence,
        wordCount: result.word_count
      });

      return {
        content: [{
          type: ContentType.TEXT,
          text: `Text Extraction Results\n${'='.repeat(50)}\n\n${JSON.stringify(result, null, 2)}\n\n${'='.repeat(50)}\n\nExtracted Text:\n${result.extracted_text}`
        }]
      };

    } catch (error) {
      this.logger.error('Text extraction failed', error as Error, { path: args.path });
      throw error;
    }
  }

  /**
   * Perform comprehensive image analysis
   */
  private async analyzeImage(path: string, options: ImageAnalysisOptions): Promise<ImageAnalysisResult> {
    // Validate file
    await this.validateImageFile(path);
    
    const stats = await stat(path);
    const imageBuffer = await readFile(path);
    
    // Get basic image metadata using Sharp
    const sharpImage = sharp(imageBuffer);
    const metadata = await sharpImage.metadata();
    
    // Build analysis result
    const result: ImageAnalysisResult = {
      fileInfo: {
        path: path,
        filename: basename(path),
        sizeBytes: stats.size,
        format: metadata.format?.toUpperCase() || 'UNKNOWN',
        mimeType: mime.lookup(path) || 'application/octet-stream',
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
      },
      technicalProperties: {
        width: metadata.width || 0,
        height: metadata.height || 0,
        channels: metadata.channels || 0,
        depth: metadata.depth || 'unknown',
        density: metadata.density,
        hasAlpha: metadata.hasAlpha || false,
        colorSpace: metadata.space || 'unknown',
        compression: metadata.compression,
        orientation: metadata.orientation,
      },
      analysisTimestamp: new Date().toISOString(),
      serverInfo: {
        analyzer: 'mcp-filebridge',
        version: '1.0.0',
        note: 'This analysis provides only technical metadata and properties. For content identification, use the base64_data with a vision-enabled LLM like GPT-4V or Claude Vision.'
      }
    };

    // Add EXIF metadata if requested
    if (options.includeExif) {
      try {
        const exifData = await exifr.parse(imageBuffer);
        result.exifMetadata = exifData || { note: 'No EXIF data available' };
      } catch (error) {
        result.exifMetadata = { error: 'EXIF parsing failed', details: (error as Error).message };
      }
    }

    // Add OCR results if requested
    if (options.includeOcr && this.ocrWorker) {
      try {
        const { data } = await this.ocrWorker.recognize(imageBuffer);
        result.ocrResults = {
          extractedText: data.text.trim() || 'No text detected',
          confidence: Math.round(data.confidence),
          language: 'eng',
          blocks: this.processTextBlocks(data)
        };
      } catch (error) {
        result.ocrResults = {
          extractedText: '',
          confidence: 0,
          language: 'eng',
          blocks: []
        };
        this.logger.warn('OCR processing failed', { error: (error as Error).message });
      }
    }

    // Add base64 data if requested
    if (options.returnBase64) {
      try {
        let processedBuffer = imageBuffer;
        
        // Resize if image is too large
        if ((metadata.width || 0) > options.maxDimension! || (metadata.height || 0) > options.maxDimension!) {
          processedBuffer = await sharpImage
            .resize(options.maxDimension, options.maxDimension, { 
              fit: 'inside', 
              withoutEnlargement: true 
            })
            .jpeg({ quality: options.quality })
            .toBuffer();
        }
        
        result.base64Data = {
          dataUrl: `data:${result.fileInfo.mimeType};base64,${processedBuffer.toString('base64')}`,
          sizeBytes: processedBuffer.length,
          resized: processedBuffer.length !== imageBuffer.length,
          maxDimensionApplied: options.maxDimension!
        };
      } catch (error) {
        this.logger.error('Base64 encoding failed', error as Error);
        result.base64Data = {
          dataUrl: '',
          sizeBytes: 0,
          resized: false,
          maxDimensionApplied: options.maxDimension!
        };
      }
    }

    return result;
  }

  /**
   * Validate image file
   */
  private async validateImageFile(path: string): Promise<void> {
    // Check file exists and is readable
    await access(path, constants.F_OK | constants.R_OK);
    
    // Check file size
    const stats = await stat(path);
    if (stats.size > this.maxFileSize) {
      throw new Error(`File too large: ${stats.size} bytes (max: ${this.maxFileSize})`);
    }
    
    // Check file extension
    const ext = extname(path).toLowerCase();
    if (!this.supportedFormats.includes(ext)) {
      throw new Error(`Unsupported image format: ${ext}. Supported formats: ${this.supportedFormats.join(', ')}`);
    }
  }

  /**
   * Process OCR text blocks for detailed positioning
   */
  private processTextBlocks(ocrData: any): TextBlock[] {
    if (!ocrData.blocks) return [];
    
    return ocrData.blocks.map((block: any) => ({
      text: block.text || '',
      confidence: Math.round(block.confidence || 0),
      bbox: {
        x0: block.bbox?.x0 || 0,
        y0: block.bbox?.y0 || 0,
        x1: block.bbox?.x1 || 0,
        y1: block.bbox?.y1 || 0,
      }
    }));
  }

  /**
   * Format analysis result for display
   */
  private formatAnalysisResult(result: ImageAnalysisResult): string {
    const sections = [
      'Image Analysis Results',
      '='.repeat(80),
      '',
      '📁 File Information:',
      `   • Path: ${result.fileInfo.path}`,
      `   • Filename: ${result.fileInfo.filename}`,
      `   • Size: ${this.formatBytes(result.fileInfo.sizeBytes)}`,
      `   • Format: ${result.fileInfo.format}`,
      `   • MIME Type: ${result.fileInfo.mimeType}`,
      `   • Created: ${result.fileInfo.created}`,
      `   • Modified: ${result.fileInfo.modified}`,
      '',
      '🔧 Technical Properties:',
      `   • Dimensions: ${result.technicalProperties.width} × ${result.technicalProperties.height} pixels`,
      `   • Channels: ${result.technicalProperties.channels}`,
      `   • Bit Depth: ${result.technicalProperties.depth}`,
      `   • Color Space: ${result.technicalProperties.colorSpace}`,
      `   • Has Alpha: ${result.technicalProperties.hasAlpha ? 'Yes' : 'No'}`,
      `   • Density: ${result.technicalProperties.density || 'Unknown'} DPI`,
      `   • Compression: ${result.technicalProperties.compression || 'Unknown'}`,
      `   • Orientation: ${result.technicalProperties.orientation || 'Unknown'}`,
    ];

    if (result.exifMetadata) {
      sections.push('', '📷 EXIF Metadata:', JSON.stringify(result.exifMetadata, null, 2));
    }

    if (result.ocrResults) {
      sections.push(
        '',
        '📝 OCR Results:',
        `   • Confidence: ${result.ocrResults.confidence}%`,
        `   • Language: ${result.ocrResults.language}`,
        `   • Text Blocks: ${result.ocrResults.blocks?.length || 0}`,
        '',
        '   Extracted Text:',
        `   ${result.ocrResults.extractedText || 'No text detected'}`
      );
    }

    if (result.base64Data) {
      sections.push(
        '',
        '🖼️ Base64 Data:',
        `   • Size: ${this.formatBytes(result.base64Data.sizeBytes)}`,
        `   • Resized: ${result.base64Data.resized ? 'Yes' : 'No'}`,
        `   • Max Dimension: ${result.base64Data.maxDimensionApplied}px`,
        `   • Data URL: ${result.base64Data.dataUrl.substring(0, 100)}...`
      );
    }

    sections.push(
      '',
      '='.repeat(80),
      '⚠️  IMPORTANT NOTES:',
      '',
      '• This analysis provides ONLY technical metadata and properties',
      '• NO assumptions are made about image content (objects, scenes, people)',
      '• For content identification, use the base64_data with vision-enabled LLMs',
      '• Compatible with: GPT-4V, Claude Vision, Gemini Vision, etc.',
      '',
      `📊 Analysis completed at: ${result.analysisTimestamp}`,
      `🔧 Analyzer: ${result.serverInfo.analyzer} v${result.serverInfo.version}`,
      '',
      '='.repeat(80)
    );

    return sections.join('\n');
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
      this.ocrWorker = undefined;
    }
  }
}
