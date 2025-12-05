/**
 * Time estimation utilities for the build command
 */

import * as os from 'os';

export interface SystemInfo {
   cpuModel: string;
   cpuCores: number;
   totalMemoryGB: number;
   platform: NodeJS.Platform;
   arch: string;
}

export interface TimeEstimate {
   estimatedSeconds: number;
   formattedTime: string;
   chunksPerSecond: number;
   systemInfo: SystemInfo;
}

/**
 * Get system information for time estimation
 */
export function getSystemInfo(): SystemInfo {
   const cpus = os.cpus();

   return {
      cpuModel: cpus[0]?.model || 'Unknown CPU',
      cpuCores: cpus.length,
      totalMemoryGB: Math.round(os.totalmem() / (1024 * 1024 * 1024) * 10) / 10,
      platform: os.platform(),
      arch: os.arch(),
   };
}

/**
 * Baseline embedding rates (chunks per second) for different CPU types.
 * These are conservative estimates for the BGE-small model with q8 quantization.
 *
 * Rates are based on batch size of 32 and typical chunk sizes (~1000 chars).
 * Estimates account for model warmup overhead on first batch.
 */

/**
 * Performance configuration for different CPU architectures and models
 */
interface PerformanceConfig {

   /** Function to determine if this config applies to the system */
   matcher: (systemInfo: SystemInfo) => boolean;

   /** Function to calculate chunks per second for this system */
   calculator: (systemInfo: SystemInfo) => number;
}

/**
 * Performance configurations in priority order (first match wins)
 */
const PERFORMANCE_CONFIGS: PerformanceConfig[] = [
   // Apple Silicon M4 series
   {
      matcher: (info) => {
         return info.arch === 'arm64' && info.platform === 'darwin' && info.cpuModel.includes('M4');
      },
      calculator: (info) => {
         if (info.cpuCores >= 14) {
            return 70; // M4 Pro/Max
         }
         if (info.cpuCores >= 10) {
            return 65; // M4 Pro
         }
         return 60; // M4 base
      },
   },
   // Apple Silicon M3 series
   {
      matcher: (info) => {
         return info.arch === 'arm64' && info.platform === 'darwin' && info.cpuModel.includes('M3');
      },
      calculator: (info) => {
         if (info.cpuCores >= 14) {
            return 60; // M3 Pro/Max
         }
         if (info.cpuCores >= 11) {
            return 55; // M3 Pro
         }
         return 50; // M3 base
      },
   },
   // Apple Silicon M2 series
   {
      matcher: (info) => {
         return info.arch === 'arm64' && info.platform === 'darwin' && info.cpuModel.includes('M2');
      },
      calculator: (info) => {
         if (info.cpuCores >= 12) {
            return 55; // M2 Pro/Max
         }
         if (info.cpuCores >= 10) {
            return 50; // M2 Pro
         }
         return 45; // M2 base
      },
   },
   // Apple Silicon M1 series
   {
      matcher: (info) => {
         return info.arch === 'arm64' && info.platform === 'darwin' && info.cpuModel.includes('M1');
      },
      calculator: (info) => {
         if (info.cpuCores >= 10) {
            return 45; // M1 Pro/Max
         }
         if (info.cpuCores >= 8) {
            return 40; // M1 Pro
         }
         return 35; // M1 base
      },
   },
   // Other Apple Silicon (unknown variants)
   {
      matcher: (info) => {
         return info.arch === 'arm64' && info.platform === 'darwin';
      },
      calculator: () => {
         return 40;
      },
   },
   // Intel/AMD x64 - scale by core count
   {
      matcher: (info) => {
         return info.arch === 'x64';
      },
      calculator: (info) => {
         if (info.cpuCores >= 16) {
            return 30; // High-end desktop/server
         }
         if (info.cpuCores >= 8) {
            return 22; // Mid-range
         }
         if (info.cpuCores >= 4) {
            return 15; // Low-mid range
         }
         return 10; // Low-end
      },
   },
   // ARM Linux (e.g., Raspberry Pi, AWS Graviton)
   {
      matcher: (info) => {
         return info.arch === 'arm64';
      },
      calculator: (info) => {
         return info.cpuCores >= 8 ? 20 : 8;
      },
   },
   // Fallback for unknown architectures
   {
      matcher: () => {
         return true;
      },
      calculator: () => {
         return 15;
      },
   },
];

function getBaselineChunksPerSecond(systemInfo: SystemInfo): number {
   // Find the first matching configuration
   const matchedConfig = PERFORMANCE_CONFIGS.find((config) => {
      return config.matcher(systemInfo);
   });

   if (!matchedConfig) {
      // This should never happen due to the fallback matcher, but just in case
      return 15;
   }

   return matchedConfig.calculator(systemInfo);
}

/**
 * Format seconds into a human-readable time string
 */
function formatTime(seconds: number): string {
   if (seconds < 60) {
      return `${Math.round(seconds)}s`;
   }

   const minutes = Math.floor(seconds / 60),
         remainingSeconds = Math.round(seconds % 60);

   if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
   }

   const hours = Math.floor(minutes / 60),
         remainingMinutes = minutes % 60;

   if (remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m`;
   }
   return `${hours}h`;
}

/**
 * Estimate the time to embed a given number of chunks
 */
export function estimateEmbeddingTime(chunkCount: number): TimeEstimate {
   const systemInfo = getSystemInfo(),
         chunksPerSecond = getBaselineChunksPerSecond(systemInfo),
         estimatedSeconds = chunkCount / chunksPerSecond;

   return {
      estimatedSeconds,
      formattedTime: formatTime(estimatedSeconds),
      chunksPerSecond,
      systemInfo,
   };
}

/**
 * Format system info for display
 */
export function formatSystemInfo(info: SystemInfo): string {
   // Shorten CPU model name for display
   let cpuName = info.cpuModel;

   cpuName = cpuName
      .replace(/\(R\)/g, '')
      .replace(/\(TM\)/g, '')
      .replace(/CPU\s*@.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

   // Truncate if too long
   if (cpuName.length > 40) {
      cpuName = cpuName.substring(0, 37) + '...';
   }

   return `${cpuName} (${info.cpuCores} cores)`;
}
