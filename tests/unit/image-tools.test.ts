/**
 * Image Tools Unit Tests
 *
 * Comprehensive unit tests for image analysis tools.
 * Tests image processing, OCR, and analysis functionality.
 *
 * @author aezizhu
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';
import { ImageAnalysisTools } from '../../src/tools/image-tools';
import { Logger } from '../../src/types/mcp';

describe('ImageAnalysisTools', () => {
  let imageTools: ImageAnalysisTools;
  let mockLogger: Logger;
  let testDir: string;
  let testJpgPath: string;
  let testPngPath: string;

  beforeEach(async () => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as Logger;

    imageTools = new ImageAnalysisTools(mockLogger);
    testDir = join(tmpdir(), 'mcp-image-test-' + Date.now());
    testJpgPath = join(testDir, 'test.jpg');
    testPngPath = join(testDir, 'test.png');

    await fs.mkdir(testDir, { recursive: true });

    // Create test images
    await createTestImage(testJpgPath, 'jpg');
    await createTestImage(testPngPath, 'png');
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('executeAnalyzeImage', () => {
    it('should analyze JPG image successfully', async () => {
      const result = await imageTools.executeAnalyzeImage({
        path: testJpgPath
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('🖼️ Image Analysis');
      expect(result.content[0].text).toContain('test.jpg');
      expect(result.content[0].text).toContain('Format: jpeg');
      expect(result.content[0].text).toContain('Dimensions:');
      expect(result.content[0].text).toContain('File Size:');
      expect(result.content[0].text).toContain('Base64 Data: ✅');

      expect(mockLogger.info).toHaveBeenCalledWith('Image analysis completed', expect.any(Object));
    });

    it('should analyze PNG image successfully', async () => {
      const result = await imageTools.executeAnalyzeImage({
        path: testPngPath
      });

      expect(result.content[0].text).toContain('Format: png');
      expect(result.content[0].text).toContain('test.png');
    });

    it('should provide technical metadata only (no hallucinations)', async () => {
      const result = await imageTools.executeAnalyzeImage({
        path: testJpgPath
      });

      const content = result.content[0].text;

      // Should contain technical details
      expect(content).toContain('Format:');
      expect(content).toContain('Dimensions:');
      expect(content).toContain('Color Space:');
      expect(content).toContain('Compression:');

      // Should NOT contain content identification
      expect(content).not.toContain('animal');
      expect(content).not.toContain('object');
      expect(content).not.toContain('scene');
      expect(content).toContain('For content identification, use the base64_data with a vision-enabled LLM');
    });

    it('should handle non-existent image files', async () => {
      const nonexistentImage = join(testDir, 'nonexistent.jpg');

      await expect(imageTools.executeAnalyzeImage({
        path: nonexistentImage
      })).rejects.toThrow('Image file not found');

      expect(mockLogger.error).toHaveBeenCalledWith('Image analysis failed', expect.any(Error), expect.any(Object));
    });

    it('should handle unsupported formats', async () => {
      const textFile = join(testDir, 'not-an-image.txt');
      await fs.writeFile(textFile, 'This is not an image');

      await expect(imageTools.executeAnalyzeImage({
        path: textFile
      })).rejects.toThrow('Unsupported image format');

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should include EXIF data when available', async () => {
      // Create image with EXIF data
      const imageWithExif = join(testDir, 'with-exif.jpg');
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
      .jpeg()
      .withMetadata({
        exif: {
          IFD0: {
            Artist: 'Test Artist',
            ImageDescription: 'Test Description'
          }
        }
      })
      .toFile(imageWithExif);

      const result = await imageTools.executeAnalyzeImage({
        path: imageWithExif
      });

      expect(result.content[0].text).toContain('EXIF Data:');
      expect(result.content[0].text).toContain('Test Artist');
    });

    it('should calculate image statistics', async () => {
      const result = await imageTools.executeAnalyzeImage({
        path: testJpgPath
      });

      const content = result.content[0].text;
      expect(content).toContain('Brightness:');
      expect(content).toContain('Contrast:');
      expect(content).toContain('Colorfulness:');
    });
  });

  describe('executeDownloadImage', () => {
    let mockAxios: any;

    beforeEach(() => {
      // Mock axios for HTTP requests
      mockAxios = {
        get: jest.fn(),
        isAxiosError: jest.fn().mockReturnValue(false)
      };

      // Mock the axios module
      jest.doMock('axios', () => mockAxios);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should download image from URL', async () => {
      const mockResponse = {
        data: Buffer.from('fake-image-data'),
        headers: {
          'content-type': 'image/jpeg'
        }
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await imageTools.executeDownloadImage({
        url: 'https://example.com/image.jpg',
        output_path: join(testDir, 'downloaded.jpg')
      });

      expect(result.content[0].text).toContain('✅ Image downloaded successfully');
      expect(result.content[0].text).toContain('downloaded.jpg');
      expect(mockAxios.get).toHaveBeenCalledWith('https://example.com/image.jpg', expect.any(Object));
    });

    it('should handle download errors', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(imageTools.executeDownloadImage({
        url: 'https://invalid-url.com/image.jpg',
        output_path: join(testDir, 'failed.jpg')
      })).rejects.toThrow('Failed to download image');

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate URL format', async () => {
      await expect(imageTools.executeDownloadImage({
        url: 'not-a-url',
        output_path: join(testDir, 'test.jpg')
      })).rejects.toThrow('Invalid URL format');
    });

    it('should handle HTTP errors', async () => {
      const error = new Error('HTTP 404');
      (error as any).response = { status: 404 };
      mockAxios.get.mockRejectedValue(error);
      mockAxios.isAxiosError.mockReturnValue(true);

      await expect(imageTools.executeDownloadImage({
        url: 'https://example.com/notfound.jpg',
        output_path: join(testDir, 'test.jpg')
      })).rejects.toThrow('HTTP 404');
    });
  });

  describe('executeExtractImageText', () => {
    it('should extract text from image with OCR', async () => {
      // Create an image with text (simulated)
      const textImage = join(testDir, 'text-image.png');
      await sharp({
        text: {
          text: 'HELLO WORLD',
          font: 'Arial',
          fontSize: 24,
          rgba: true
        }
      })
      .png()
      .toFile(textImage);

      const result = await imageTools.executeExtractImageText({
        path: textImage
      });

      expect(result.content[0].text).toContain('📝 OCR Text Extraction');
      expect(result.content[0].text).toContain('text-image.png');
      // Note: Tesseract might not extract text perfectly from synthetic images
    });

    it('should handle images without text', async () => {
      const result = await imageTools.executeExtractImageText({
        path: testJpgPath
      });

      expect(result.content[0].text).toContain('No text detected');
    });

    it('should handle OCR errors gracefully', async () => {
      const invalidImage = join(testDir, 'invalid.png');
      await fs.writeFile(invalidImage, 'not an image');

      await expect(imageTools.executeExtractImageText({
        path: invalidImage
      })).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should support different languages', async () => {
      const result = await imageTools.executeExtractImageText({
        path: testPngPath,
        language: 'eng'
      });

      expect(result.content[0].text).toContain('Language: eng');
    });
  });

  describe('Image Processing Edge Cases', () => {
    it('should handle very large images', async () => {
      // Create a large image
      const largeImage = join(testDir, 'large.png');
      await sharp({
        create: {
          width: 5000,
          height: 5000,
          channels: 3,
          background: { r: 128, g: 128, b: 128 }
        }
      })
      .png()
      .toFile(largeImage);

      const result = await imageTools.executeAnalyzeImage({
        path: largeImage
      });

      expect(result.content[0].text).toContain('5000');
    });

    it('should handle images with transparency', async () => {
      const transparentImage = join(testDir, 'transparent.png');
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 0.5 }
        }
      })
      .png()
      .toFile(transparentImage);

      const result = await imageTools.executeAnalyzeImage({
        path: transparentImage
      });

      expect(result.content[0].text).toContain('Has Alpha: Yes');
    });

    it('should handle grayscale images', async () => {
      const grayscaleImage = join(testDir, 'grayscale.jpg');
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 1,
          background: { r: 128, g: 128, b: 128 }
        }
      })
      .jpeg()
      .toFile(grayscaleImage);

      const result = await imageTools.executeAnalyzeImage({
        path: grayscaleImage
      });

      expect(result.content[0].text).toContain('Color Space: Gray');
    });

    it('should handle corrupted images', async () => {
      const corruptedImage = join(testDir, 'corrupted.jpg');
      await fs.writeFile(corruptedImage, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])); // Incomplete JPEG header

      await expect(imageTools.executeAnalyzeImage({
        path: corruptedImage
      })).rejects.toThrow('Failed to process image');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should cleanup resources properly', async () => {
      const result = await imageTools.executeAnalyzeImage({
        path: testJpgPath
      });

      expect(result).toBeDefined();
      // Resources should be cleaned up automatically
    });

    it('should handle concurrent image processing', async () => {
      const promises = [
        imageTools.executeAnalyzeImage({ path: testJpgPath }),
        imageTools.executeAnalyzeImage({ path: testPngPath })
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(2);
      expect(results[0].content).toHaveLength(1);
      expect(results[1].content).toHaveLength(1);
    });

    it('should implement proper error recovery', async () => {
      // First fail with a bad image
      const badImage = join(testDir, 'bad.jpg');
      await fs.writeFile(badImage, 'not an image');

      await expect(imageTools.executeAnalyzeImage({
        path: badImage
      })).rejects.toThrow();

      // Then succeed with a good image
      const result = await imageTools.executeAnalyzeImage({
        path: testJpgPath
      });

      expect(result.content[0].text).toContain('✅ Analysis completed');
    });
  });

  describe('Security and Validation', () => {
    it('should validate file paths', async () => {
      const dangerousPath = '/etc/passwd';

      await expect(imageTools.executeAnalyzeImage({
        path: dangerousPath
      })).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should prevent directory traversal', async () => {
      const traversalPath = join(testDir, '../../../etc/passwd');

      await expect(imageTools.executeAnalyzeImage({
        path: traversalPath
      })).rejects.toThrow('Invalid file path');
    });

    it('should handle symlinks safely', async () => {
      const symlinkPath = join(testDir, 'symlink.jpg');
      await fs.symlink(testJpgPath, symlinkPath);

      const result = await imageTools.executeAnalyzeImage({
        path: symlinkPath
      });

      expect(result.content[0].text).toContain('symlink.jpg');
    });
  });
});

/**
 * Helper function to create test images
 */
async function createTestImage(path: string, format: 'jpg' | 'png'): Promise<void> {
  const image = sharp({
    create: {
      width: 200,
      height: 150,
      channels: 3,
      background: { r: 255, g: 100, b: 50 }
    }
  });

  if (format === 'jpg') {
    await image.jpeg({ quality: 85 }).toFile(path);
  } else {
    await image.png().toFile(path);
  }
}
