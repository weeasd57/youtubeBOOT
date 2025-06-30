import React from 'react';
/**
 * Optimized Performance monitoring utilities
 * تحسين الأداء ومراقبة الأداء - نسخة محسنة
 */

// Lightweight Performance Monitor - Disabled by default to prevent Long Tasks
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    // Disable by default to prevent Long Tasks in production
    this.isEnabled = false;
    this.logThrottle = new Map();
    this.LOG_THROTTLE_MS = 5000; // 5 seconds between similar logs
  }

  // Throttled logging to prevent spam
  throttledLog(message, data = null, level = 'log') {
    if (!this.isEnabled) return;
    
    const key = `${level}-${message}`;
    const now = Date.now();
    const lastLog = this.logThrottle.get(key) || 0;
    
    if (now - lastLog > this.LOG_THROTTLE_MS) {
      if (level === 'error') {
        console.error(message, data || '');
      } else if (level === 'warn') {
        console.warn(message, data || '');
      } else {
        console.log(message, data || '');
      }
      this.logThrottle.set(key, now);
    }
  }

  // Lightweight timing - only when enabled
  startTiming(label) {
    if (!this.isEnabled) return null;
    
    const startTime = performance.now();
    this.metrics.set(label, { startTime, endTime: null, duration: null });
    return startTime;
  }

  // End timing with minimal logging
  endTiming(label) {
    if (!this.isEnabled) return null;
    
    const metric = this.metrics.get(label);
    if (!metric) return null;

    const endTime = performance.now();
    const duration = endTime - metric.startTime;
    
    metric.endTime = endTime;
    metric.duration = duration;

    // Only log slow operations to reduce noise
    if (duration > 1000) {
      this.throttledLog(`🐌 Slow operation: ${label}: ${duration.toFixed(2)}ms`, null, 'warn');
    }

    return duration;
  }

  // Minimal API monitoring
  monitorApiCall(url, options = {}) {
    if (!this.isEnabled) {
      return fetch(url, options);
    }

    const label = `API: ${url.split('?')[0]}`; // Remove query params for cleaner logs
    this.startTiming(label);

    return fetch(url, options)
      .then(response => {
        const duration = this.endTiming(label);
        
        // Only log slow API calls
        if (duration > 2000) {
          this.throttledLog(`📡 Slow API: ${response.status} - ${url} (${duration.toFixed(2)}ms)`, null, 'warn');
        }
        
        return response;
      })
      .catch(error => {
        this.endTiming(label);
        this.throttledLog(`❌ API Error: ${url}`, error, 'error');
        throw error;
      });
  }

  // Lightweight component monitoring
  monitorComponentRender(componentName, renderFn) {
    if (!this.isEnabled) return renderFn();

    const label = `Render: ${componentName}`;
    this.startTiming(label);
    
    try {
      const result = renderFn();
      const duration = this.endTiming(label);
      
      // Only log slow renders
      if (duration > 100) {
        this.throttledLog(`🐌 Slow render: ${componentName} (${duration.toFixed(2)}ms)`, null, 'warn');
      }
      
      return result;
    } catch (error) {
      this.endTiming(label);
      this.throttledLog(`❌ Render Error: ${componentName}`, error, 'error');
      throw error;
    }
  }

  // Minimal Web Vitals setup - only critical metrics
  setupWebVitals() {
    if (typeof window === 'undefined' || !this.isEnabled) return;

    // Only monitor long tasks with throttled logging
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            // Only log very long tasks to reduce noise
            if (entry.duration > 100) {
              this.throttledLog(`🐌 Long Task detected: ${entry.duration.toFixed(2)}ms`, null, 'warn');
            }
          });
        });

        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', longTaskObserver);
      } catch (e) {
        // Silently fail if not supported
      }
    }
  }

  // Enable monitoring (use sparingly)
  enable() {
    this.isEnabled = true;
    this.setupWebVitals();
  }

  // Disable monitoring
  disable() {
    this.isEnabled = false;
    this.cleanup();
  }

  // Cleanup observers
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.metrics.clear();
    this.logThrottle.clear();
  }

  // Get metrics summary (only when enabled)
  getMetricsSummary() {
    if (!this.isEnabled) return null;
    
    const metrics = Array.from(this.metrics.values());
    const slowOperations = metrics.filter(m => m.duration > 1000);
    
    return {
      totalOperations: metrics.length,
      slowOperations: slowOperations.length,
      averageDuration: metrics.length > 0 ? 
        metrics.reduce((sum, m) => sum + (m.duration || 0), 0) / metrics.length : 0
    };
  }
}

// Create singleton instance - disabled by default
const performanceMonitor = new PerformanceMonitor();

// Lightweight React hook
export function usePerformanceMonitor() {
  const [isEnabled, setIsEnabled] = React.useState(false);

  const enable = React.useCallback(() => {
    performanceMonitor.enable();
    setIsEnabled(true);
  }, []);

  const disable = React.useCallback(() => {
    performanceMonitor.disable();
    setIsEnabled(false);
  }, []);

  React.useEffect(() => {
    return () => {
      performanceMonitor.cleanup();
    };
  }, []);

  return {
    isEnabled,
    enable,
    disable,
    getSummary: () => performanceMonitor.getMetricsSummary()
  };
}

// Lightweight HOC - only wraps when monitoring is enabled
export function withPerformanceMonitoring(WrappedComponent, componentName) {
  const MonitoredComponent = React.memo((props) => {
    if (!performanceMonitor.isEnabled) {
      return React.createElement(WrappedComponent, props);
    }
    
    return performanceMonitor.monitorComponentRender(
      componentName || WrappedComponent.displayName || WrappedComponent.name,
      () => React.createElement(WrappedComponent, props)
    );
  });

  MonitoredComponent.displayName = `withPerformanceMonitoring(${componentName || WrappedComponent.displayName || WrappedComponent.name})`;
  
  return MonitoredComponent;
}

// Optimized utility functions
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Lightweight memory monitoring
export const checkMemoryUsage = () => {
  if (typeof window === 'undefined' || !window.performance?.memory) return null;

  const memory = window.performance.memory;
  const used = Math.round(memory.usedJSHeapSize / 1048576);
  const limit = Math.round(memory.jsHeapSizeLimit / 1048576);
  const usage = used / limit;

  // Only warn if usage is very high
  if (usage > 0.9) {
    console.warn(`⚠️ Critical memory usage: ${used}MB / ${limit}MB (${(usage * 100).toFixed(1)}%)`);
  }

  return { used, limit, usage };
};

export default performanceMonitor;