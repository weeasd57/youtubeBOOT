// Request priority levels
export enum Priority {
  HIGH = 0,
  MEDIUM = 1,
  LOW = 2
}

// Queue item interface
export interface QueueItem {
  key: string;
  operation: () => Promise<any>;
  priority: Priority;
  timestamp: number;
}

// Request controller configuration
export interface RequestConfig {
  REFRESH_INTERVALS: {
    MIN: number;     // Minimum time between manual refreshes
    BATCH: number;   // Time between batch operations
    TIMEOUT: number; // Request timeout
    RETRY: number;   // Time between retries
    BACKOFF: number; // Exponential backoff multiplier
  };
  MAX_RETRIES: number;
  BATCH_SIZE: number;
}