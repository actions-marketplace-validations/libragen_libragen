/**
 * Tests for time estimation utilities
 */

import { describe, it, expect } from 'vitest';
import {
   getSystemInfo,
   estimateEmbeddingTime,
   formatSystemInfo,
} from '../time-estimate.ts';

describe('time-estimate', () => {
   describe('Apple Silicon performance scaling', () => {
      it('provides reasonable estimates for current system', () => {
         const info = getSystemInfo();

         const estimate = estimateEmbeddingTime(100);

         // Verify the estimate is reasonable for the detected system
         expect(estimate.chunksPerSecond).toBeGreaterThan(10);
         expect(estimate.chunksPerSecond).toBeLessThan(100);
         expect(estimate.estimatedSeconds).toBeGreaterThan(0);

         // For Apple Silicon systems, should get decent performance
         if (info.arch === 'arm64' && info.platform === 'darwin') {
            expect(estimate.chunksPerSecond).toBeGreaterThanOrEqual(35);
         }
      });
   });

   describe('getSystemInfo', () => {
      it('returns system information', () => {
         const info = getSystemInfo();

         expect(info).toHaveProperty('cpuModel');
         expect(info).toHaveProperty('cpuCores');
         expect(info).toHaveProperty('totalMemoryGB');
         expect(info).toHaveProperty('platform');
         expect(info).toHaveProperty('arch');

         expect(typeof info.cpuModel).toBe('string');
         expect(typeof info.cpuCores).toBe('number');
         expect(info.cpuCores).toBeGreaterThan(0);
         expect(typeof info.totalMemoryGB).toBe('number');
         expect(info.totalMemoryGB).toBeGreaterThan(0);
      });
   });

   describe('estimateEmbeddingTime', () => {
      it('returns time estimate for chunk count', () => {
         const estimate = estimateEmbeddingTime(100);

         expect(estimate).toHaveProperty('estimatedSeconds');
         expect(estimate).toHaveProperty('formattedTime');
         expect(estimate).toHaveProperty('chunksPerSecond');
         expect(estimate).toHaveProperty('systemInfo');

         expect(typeof estimate.estimatedSeconds).toBe('number');
         expect(estimate.estimatedSeconds).toBeGreaterThan(0);
         expect(typeof estimate.formattedTime).toBe('string');
         expect(estimate.chunksPerSecond).toBeGreaterThan(0);
      });

      it('scales linearly with chunk count', () => {
         const estimate100 = estimateEmbeddingTime(100);

         const estimate200 = estimateEmbeddingTime(200);

         // Should be approximately 2x (allowing for floating point)
         expect(estimate200.estimatedSeconds / estimate100.estimatedSeconds).toBeCloseTo(2, 1);
      });

      it('formats time correctly for small durations', () => {
         // Force a small estimate by using few chunks
         const estimate = estimateEmbeddingTime(10);

         // Should be in seconds format for small values
         expect(estimate.formattedTime).toMatch(/^\d+s$|^\d+m/);
      });

      it('formats time correctly for large durations', () => {
         // Force a large estimate by using many chunks
         const estimate = estimateEmbeddingTime(10000);

         // Should include minutes for larger values
         expect(estimate.formattedTime).toMatch(/\d+m|\d+h/);
      });
   });

   describe('formatSystemInfo', () => {
      it('formats system info for display', () => {
         const info = getSystemInfo();

         const formatted = formatSystemInfo(info);

         expect(typeof formatted).toBe('string');
         expect(formatted).toContain('cores');
         expect(formatted.length).toBeLessThanOrEqual(60); // Should be reasonably short
      });

      it('truncates long CPU names', () => {
         const info = {
            cpuModel: 'Intel(R) Core(TM) i9-12900K CPU @ 3.20GHz With Extra Long Name That Should Be Truncated',
            cpuCores: 24,
            totalMemoryGB: 64,
            platform: 'linux' as const,
            arch: 'x64',
         };

         const formatted = formatSystemInfo(info);

         expect(formatted.length).toBeLessThanOrEqual(60);
      });

      it('removes trademark symbols from CPU names', () => {
         const info = {
            cpuModel: 'Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz',
            cpuCores: 8,
            totalMemoryGB: 32,
            platform: 'win32' as const,
            arch: 'x64',
         };

         const formatted = formatSystemInfo(info);

         expect(formatted).not.toContain('(R)');
         expect(formatted).not.toContain('(TM)');
      });
   });
});
