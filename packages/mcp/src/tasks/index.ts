/**
 * Tasks module - Async build task management
 */

export {
   TaskManager,
   getTaskManager,
   resetTaskManager,
   type BuildTask,
   type BuildParams,
   type TaskStatus,
   type TaskManagerConfig,
} from './task-manager.ts';

export {
   initializeWorkerPool,
   startWorker,
   cancelWorker,
   getActiveWorkerCount,
} from './worker-pool.ts';

export type { WorkerInMessage, WorkerOutMessage } from './build-worker.ts';
