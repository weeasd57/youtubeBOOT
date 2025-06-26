import { Priority, QueueItem, RequestConfig } from '@/types/request';

const DEFAULT_CONFIG: RequestConfig = {
  REFRESH_INTERVALS: {
    MIN: 180000,    // 3 minutes
    BATCH: 2000,    // 2 seconds
    TIMEOUT: 30000, // 30 seconds
    RETRY: 5000,    // 5 seconds
    BACKOFF: 1.5    // Exponential backoff multiplier
  },
  MAX_RETRIES: 3,
  BATCH_SIZE: 2
};

export class RequestController {
  private pendingRequests: Map<string, AbortController>;
  private timeouts: Map<string, NodeJS.Timeout>;
  private retryCount: Map<string, number>;
  private queue: QueueItem[];
  private isProcessing: boolean;
  private config: RequestConfig;
  private onProgress?: (key: string, progress: number) => void;

  constructor(config?: Partial<RequestConfig>) {
    this.pendingRequests = new Map();
    this.timeouts = new Map();
    this.retryCount = new Map();
    this.queue = [];
    this.isProcessing = false;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public setProgressCallback(callback: (key: string, progress: number) => void) {
    this.onProgress = callback;
  }

  public addToQueue(item: QueueItem) {
    this.queue.push(item);
    this.sortQueue();
  }

  private sortQueue() {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.timestamp - b.timestamp;
    });
  }

  public async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    
    try {
      while (this.queue.length > 0) {
        const batch = this.queue
          .slice(0, this.config.BATCH_SIZE)
          .filter(item => !this.pendingRequests.has(item.key));

        if (batch.length === 0) break;

        const batchPromises = batch.map(item => 
          this.executeWithTimeout(item.key, item.operation)
        );

        await Promise.all(batchPromises);
        
        this.queue = this.queue.filter(item => !batch.includes(item));

        if (this.queue.length > 0) {
          await new Promise(resolve => 
            setTimeout(resolve, this.config.REFRESH_INTERVALS.BATCH)
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public async executeWithTimeout<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // Abort previous request if exists
    this.abortRequest(key);

    const controller = new AbortController();
    this.pendingRequests.set(key, controller);

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('Request timeout'));
        }, this.config.REFRESH_INTERVALS.TIMEOUT);
        
        this.timeouts.set(key, timeout);
      });

      this.updateProgress(key, 0);
      const result = await Promise.race([operation(), timeoutPromise]);
      this.updateProgress(key, 100);

      this.cleanup(key);
      this.retryCount.delete(key); // Reset retry count on success
      return result;
    } catch (error) {
      const retryCount = (this.retryCount.get(key) || 0) + 1;
      this.retryCount.set(key, retryCount);

      if (retryCount <= this.config.MAX_RETRIES) {
        const delay = this.config.REFRESH_INTERVALS.RETRY * 
          Math.pow(this.config.REFRESH_INTERVALS.BACKOFF, retryCount - 1);
        
        this.updateProgress(key, retryCount * 25);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithTimeout(key, operation);
      }

      throw error;
    }
  }

  private cleanup(key: string) {
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }
    this.pendingRequests.delete(key);
  }

  private abortRequest(key: string) {
    const controller = this.pendingRequests.get(key);
    if (controller) {
      controller.abort();
      this.cleanup(key);
    }
  }

  private updateProgress(key: string, value: number) {
    this.onProgress?.(key, value);
  }

  public abortAll() {
    this.pendingRequests.forEach(controller => controller.abort());
    this.timeouts.forEach(clearTimeout);
    this.pendingRequests.clear();
    this.timeouts.clear();
    this.retryCount.clear();
    this.queue = [];
    this.isProcessing = false;
  }
}