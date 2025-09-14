/**
 * Server Performance Tests
 *
 * Comprehensive performance benchmarks for MCP FileBridge.
 * Measures throughput, latency, memory usage, and scalability.
 *
 * @author aezizhu
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPEnterpriseServer } from '../../src/core/server';
import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Server Performance Benchmarks', () => {
  let server: MCPEnterpriseServer;
  let testFiles: string[] = [];
  let performanceMetrics: any = {};

  beforeAll(async () => {
    // Start server
    server = new MCPEnterpriseServer({
      server: {
        host: 'localhost',
        port: 3002 // Different port for performance tests
      },
      cache: {
        enabled: true,
        type: 'memory'
      }
    });

    await server.start();

    // Create test files of various sizes
    await createTestFiles();

    console.log('🚀 Performance test environment ready');
  }, 30000);

  afterAll(async () => {
    // Cleanup
    if (server) {
      await server.stop();
    }

    // Clean up test files
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    console.log('✅ Performance test cleanup completed');
  });

  describe('Request Latency', () => {
    it('should handle ping requests with low latency', async () => {
      const latencies: number[] = [];
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        const request = {
          jsonrpc: '2.0',
          id: i,
          method: 'tools/call',
          params: {
            name: 'ping',
            arguments: {}
          }
        };

        await server.handleRequest(JSON.stringify(request));
        const end = performance.now();
        latencies.push(end - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
      const p99Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)];

      performanceMetrics.pingLatency = {
        average: avgLatency,
        p95: p95Latency,
        p99: p99Latency,
        min: Math.min(...latencies),
        max: Math.max(...latencies)
      };

      console.log(`📊 Ping Latency: ${avgLatency.toFixed(2)}ms (P95: ${p95Latency.toFixed(2)}ms, P99: ${p99Latency.toFixed(2)}ms)`);

      expect(avgLatency).toBeLessThan(50); // Should be under 50ms
      expect(p95Latency).toBeLessThan(100); // P95 should be under 100ms
    });

    it('should handle file operations with acceptable latency', async () => {
      const smallFile = testFiles.find(f => f.includes('small.txt'))!;
      const latencies: number[] = [];
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        const request = {
          jsonrpc: '2.0',
          id: 100 + i,
          method: 'tools/call',
          params: {
            name: 'read_file',
            arguments: {
              path: smallFile
            }
          }
        };

        await server.handleRequest(JSON.stringify(request));
        const end = performance.now();
        latencies.push(end - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

      performanceMetrics.fileReadLatency = {
        average: avgLatency,
        p95: p95Latency,
        min: Math.min(...latencies),
        max: Math.max(...latencies)
      };

      console.log(`📊 File Read Latency: ${avgLatency.toFixed(2)}ms (P95: ${p95Latency.toFixed(2)}ms)`);

      expect(avgLatency).toBeLessThan(200); // Should be under 200ms for small files
      expect(p95Latency).toBeLessThan(500); // P95 should be under 500ms
    });
  });

  describe('Throughput', () => {
    it('should handle high concurrent load', async () => {
      const concurrentRequests = 100;
      const requests = Array.from({ length: concurrentRequests }, (_, i) => ({
        jsonrpc: '2.0',
        id: 200 + i,
        method: 'tools/call',
        params: {
          name: 'ping',
          arguments: {}
        }
      }));

      const start = performance.now();

      const promises = requests.map(request =>
        server.handleRequest(JSON.stringify(request))
      );

      await Promise.all(promises);

      const end = performance.now();
      const totalTime = end - start;
      const throughput = (concurrentRequests / totalTime) * 1000; // requests per second

      performanceMetrics.throughput = {
        concurrentRequests,
        totalTime,
        throughput
      };

      console.log(`📊 Throughput: ${throughput.toFixed(2)} requests/second`);

      expect(throughput).toBeGreaterThan(100); // Should handle at least 100 req/sec
    });

    it('should maintain performance under sustained load', async () => {
      const duration = 10000; // 10 seconds
      const interval = 100; // 100ms between requests
      const expectedRequests = Math.floor(duration / interval);

      let completedRequests = 0;
      const start = performance.now();

      const sustainedTest = new Promise<void>((resolve) => {
        const intervalId = setInterval(async () => {
          const request = {
            jsonrpc: '2.0',
            id: 300 + completedRequests,
            method: 'tools/call',
            params: {
              name: 'ping',
              arguments: {}
            }
          };

          try {
            await server.handleRequest(JSON.stringify(request));
            completedRequests++;
          } catch (error) {
            // Ignore individual request errors
          }

          if (performance.now() - start >= duration) {
            clearInterval(intervalId);
            resolve();
          }
        }, interval);
      });

      await sustainedTest;

      const actualThroughput = (completedRequests / duration) * 1000;
      const successRate = (completedRequests / expectedRequests) * 100;

      performanceMetrics.sustainedLoad = {
        duration,
        completedRequests,
        expectedRequests,
        throughput: actualThroughput,
        successRate
      };

      console.log(`📊 Sustained Load: ${actualThroughput.toFixed(2)} req/sec (${successRate.toFixed(2)}% success rate)`);

      expect(successRate).toBeGreaterThan(95); // Should maintain 95% success rate
      expect(actualThroughput).toBeGreaterThan(8); // Should handle ~10 req/sec sustained
    });
  });

  describe('Memory Usage', () => {
    it('should maintain stable memory usage', async () => {
      const initialMemory = process.memoryUsage();
      const memorySamples: NodeJS.MemoryUsage[] = [initialMemory];

      // Perform memory-intensive operations
      const operations = Array.from({ length: 50 }, async (_, i) => {
        const request = {
          jsonrpc: '2.0',
          id: 400 + i,
          method: 'tools/call',
          params: {
            name: 'get_server_info',
            arguments: {}
          }
        };

        await server.handleRequest(JSON.stringify(request));

        if (i % 10 === 0) {
          memorySamples.push(process.memoryUsage());
        }
      });

      await Promise.all(operations);

      const finalMemory = process.memoryUsage();
      memorySamples.push(finalMemory);

      const memoryIncrease = {
        rss: finalMemory.rss - initialMemory.rss,
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
        external: finalMemory.external - initialMemory.external
      };

      performanceMetrics.memoryUsage = {
        initial: initialMemory,
        final: finalMemory,
        increase: memoryIncrease,
        samples: memorySamples
      };

      console.log(`📊 Memory Increase: RSS: ${(memoryIncrease.rss / 1024 / 1024).toFixed(2)}MB, Heap: ${(memoryIncrease.heapUsed / 1024 / 1024).toFixed(2)}MB`);

      // Memory should not increase dramatically
      expect(memoryIncrease.heapUsed).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });

    it('should handle large file operations without excessive memory usage', async () => {
      const largeFile = testFiles.find(f => f.includes('large.txt'))!;
      const memoryBefore = process.memoryUsage();

      const request = {
        jsonrpc: '2.0',
        id: 500,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {
            path: largeFile,
            max_size: 1024 * 1024 // 1MB limit
          }
        }
      };

      await server.handleRequest(JSON.stringify(request));

      const memoryAfter = process.memoryUsage();
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      console.log(`📊 Large File Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB for 1MB file
    });
  });

  describe('Cache Performance', () => {
    it('should improve performance with caching', async () => {
      const imageFile = testFiles.find(f => f.includes('test.jpg'))!;

      // First request (cache miss)
      const firstRequest = {
        jsonrpc: '2.0',
        id: 600,
        method: 'tools/call',
        params: {
          name: 'analyze_image',
          arguments: {
            path: imageFile
          }
        }
      };

      const start1 = performance.now();
      await server.handleRequest(JSON.stringify(firstRequest));
      const end1 = performance.now();
      const firstRequestTime = end1 - start1;

      // Second request (cache hit)
      const secondRequest = {
        jsonrpc: '2.0',
        id: 601,
        method: 'tools/call',
        params: {
          name: 'analyze_image',
          arguments: {
            path: imageFile
          }
        }
      };

      const start2 = performance.now();
      await server.handleRequest(JSON.stringify(secondRequest));
      const end2 = performance.now();
      const secondRequestTime = end2 - start2;

      const improvement = ((firstRequestTime - secondRequestTime) / firstRequestTime) * 100;

      performanceMetrics.cachePerformance = {
        firstRequest: firstRequestTime,
        secondRequest: secondRequestTime,
        improvement
      };

      console.log(`📊 Cache Performance: ${firstRequestTime.toFixed(2)}ms → ${secondRequestTime.toFixed(2)}ms (${improvement.toFixed(1)}% improvement)`);

      expect(secondRequestTime).toBeLessThan(firstRequestTime);
      expect(improvement).toBeGreaterThan(50); // Should be at least 50% faster
    });
  });

  describe('Scalability', () => {
    it('should scale with increasing load', async () => {
      const loadLevels = [10, 25, 50, 100];
      const scalabilityResults: any[] = [];

      for (const load of loadLevels) {
        const requests = Array.from({ length: load }, (_, i) => ({
          jsonrpc: '2.0',
          id: 700 + i,
          method: 'tools/call',
          params: {
            name: 'ping',
            arguments: {}
          }
        }));

        const start = performance.now();
        const promises = requests.map(request =>
          server.handleRequest(JSON.stringify(request))
        );

        await Promise.all(promises);
        const end = performance.now();

        const totalTime = end - start;
        const throughput = (load / totalTime) * 1000;

        scalabilityResults.push({
          load,
          totalTime,
          throughput
        });

        console.log(`📊 Load ${load}: ${throughput.toFixed(2)} req/sec`);
      }

      performanceMetrics.scalability = scalabilityResults;

      // Throughput should scale reasonably well
      const firstThroughput = scalabilityResults[0].throughput;
      const lastThroughput = scalabilityResults[scalabilityResults.length - 1].throughput;
      const scalabilityRatio = lastThroughput / firstThroughput;

      console.log(`📊 Scalability Ratio: ${scalabilityRatio.toFixed(2)}x`);

      expect(scalabilityRatio).toBeGreaterThan(0.5); // Should maintain at least 50% efficiency
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources properly', async () => {
      // This test ensures proper cleanup after performance tests
      const initialHandles = process._getActiveHandles().length;

      // Perform some operations
      const operations = Array.from({ length: 20 }, async (_, i) => {
        const request = {
          jsonrpc: '2.0',
          id: 800 + i,
          method: 'tools/call',
          params: {
            name: 'ping',
            arguments: {}
          }
        };

        return server.handleRequest(JSON.stringify(request));
      });

      await Promise.all(operations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalHandles = process._getActiveHandles().length;

      console.log(`📊 Resource Handles: ${initialHandles} → ${finalHandles}`);

      // Handle count should not increase significantly
      expect(finalHandles - initialHandles).toBeLessThan(10);
    });
  });

  // Helper function to generate performance report
  afterAll(() => {
    console.log('\n📊 Performance Test Summary');
    console.log('='.repeat(50));

    if (performanceMetrics.pingLatency) {
      console.log(`🏓 Ping Latency: ${performanceMetrics.pingLatency.average.toFixed(2)}ms avg`);
      console.log(`   P95: ${performanceMetrics.pingLatency.p95.toFixed(2)}ms, P99: ${performanceMetrics.pingLatency.p99.toFixed(2)}ms`);
    }

    if (performanceMetrics.throughput) {
      console.log(`⚡ Throughput: ${performanceMetrics.throughput.throughput.toFixed(2)} req/sec`);
    }

    if (performanceMetrics.sustainedLoad) {
      console.log(`🔄 Sustained Load: ${performanceMetrics.sustainedLoad.throughput.toFixed(2)} req/sec`);
      console.log(`   Success Rate: ${performanceMetrics.sustainedLoad.successRate.toFixed(2)}%`);
    }

    if (performanceMetrics.memoryUsage) {
      console.log(`💾 Memory Increase: ${(performanceMetrics.memoryUsage.increase.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }

    console.log('='.repeat(50));
  });
});

/**
 * Helper function to create test files of various sizes
 */
async function createTestFiles(): Promise<void> {
  const testDir = path.join(process.cwd(), 'tests', 'temp');

  try {
    await fs.mkdir(testDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  // Small text file
  const smallFile = path.join(testDir, 'small.txt');
  await fs.writeFile(smallFile, 'This is a small test file for performance testing.');
  testFiles.push(smallFile);

  // Medium text file
  const mediumFile = path.join(testDir, 'medium.txt');
  const mediumContent = 'A'.repeat(10000); // 10KB
  await fs.writeFile(mediumFile, mediumContent);
  testFiles.push(mediumFile);

  // Large text file
  const largeFile = path.join(testDir, 'large.txt');
  const largeContent = 'A'.repeat(1000000); // 1MB
  await fs.writeFile(largeFile, largeContent);
  testFiles.push(largeFile);

  // JSON file
  const jsonFile = path.join(testDir, 'data.json');
  const jsonData = {
    name: 'Performance Test Data',
    data: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: Math.random() }))
  };
  await fs.writeFile(jsonFile, JSON.stringify(jsonData, null, 2));
  testFiles.push(jsonFile);

  console.log(`📄 Created ${testFiles.length} test files`);
}
