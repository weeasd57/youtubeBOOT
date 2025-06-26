import React from 'react';
/**
 * Performance monitoring and optimization utilities
 * تحسين الأداء ومراقبة الأداء
 */

// Performance metrics collection
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.isEnabled = process.env.NODE_ENV === 'development';
  }

  // Start timing a specific operation
  startTiming(label) {
    if (!this.isEnabled) return;
    
    const startTime = performance.now();
    this.metrics.set(label, { startTime, endTime: null, duration: null });
    
    console.log(`⏱️ Started timing: ${label}`);
    return startTime;
  }

  // End timing and log results
  endTiming(label) {
    if (!this.isEnabled) return;
    
    const metric = this.metrics.get(label);
    if (!metric) {
      console.warn(`⚠️ No timing started for: ${label}`);
      return;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;
    
    metric.endTime = endTime;
    metric.duration = duration;

    // Log performance with color coding
    const color = duration > 1000 ? '🔴' : duration > 500 ? '🟡' : '🟢';
    console.log(`${color} ${label}: ${duration.toFixed(2)}ms`);

    return duration;
  }

  // Get all metrics
  getMetrics() {
    return Array.from(this.metrics.entries()).map(([label, data]) => ({
      label,
      ...data
    }));
  }

  // Clear all metrics
  clearMetrics() {
    this.metrics.clear();
  }

  // Monitor API calls
  monitorApiCall(url, options = {}) {
    const label = `API: ${url}`;
    this.startTiming(label);

    return fetch(url, options)
      .then(response => {
        this.endTiming(label);
        
        // Log additional API metrics
        if (this.isEnabled) {
          console.log(`📡 API Response: ${response.status} - ${url}`);
        }
        
        return response;
      })
      .catch(error => {
        this.endTiming(label);
        console.error(`❌ API Error: ${url}`, error);
        throw error;
      });
  }

  // Monitor component render times
  monitorComponentRender(componentName, renderFn) {
    if (!this.isEnabled) return renderFn();

    const label = `Render: ${componentName}`;
    this.startTiming(label);
    
    try {
      const result = renderFn();
      this.endTiming(label);
      return result;
    } catch (error) {
      this.endTiming(label);
      console.error(`❌ Render Error: ${componentName}`, error);
      throw error;
    }
  }

  // Monitor database queries
  monitorDbQuery(queryName, queryFn) {
    const label = `DB: ${queryName}`;
    this.startTiming(label);

    return Promise.resolve(queryFn())
      .then(result => {
        this.endTiming(label);
        return result;
      })
      .catch(error => {
        this.endTiming(label);
        console.error(`❌ DB Error: ${queryName}`, error);
        throw error;
      });
  }

  // Setup Web Vitals monitoring
  setupWebVitals() {
    if (typeof window === 'undefined' || !this.isEnabled) return;

    // Monitor Core Web Vitals
    if ('web-vitals' in window) {
      import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        getCLS(this.logWebVital);
        getFID(this.logWebVital);
        getFCP(this.logWebVital);
        getLCP(this.logWebVital);
        getTTFB(this.logWebVital);
      });
    }

    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          console.warn(`🐌 Long Task detected: ${entry.duration.toFixed(2)}ms`);
        });
      });

      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', longTaskObserver);
      } catch (e) {
        console.warn('Long task monitoring not supported');
      }
    }
  }

  // Log Web Vital metrics
  logWebVital = (metric) => {
    const { name, value, rating } = metric;
    const emoji = rating === 'good' ? '🟢' : rating === 'needs-improvement' ? '🟡' : '🔴';
    console.log(`${emoji} ${name}: ${value.toFixed(2)} (${rating})`);
  }

  // Generate performance report
  generateReport() {
    if (!this.isEnabled) return;

    const metrics = this.getMetrics();
    const slowOperations = metrics.filter(m => m.duration > 1000);
    const totalTime = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);

    console.group('📊 Performance Report');
    console.log(`Total operations: ${metrics.length}`);
    console.log(`Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`Average time: ${(totalTime / metrics.length).toFixed(2)}ms`);
    
    if (slowOperations.length > 0) {
      console.warn(`🐌 Slow operations (>1s): ${slowOperations.length}`);
      slowOperations.forEach(op => {
        console.warn(`  - ${op.label}: ${op.duration.toFixed(2)}ms`);
      });
    }
    
    console.groupEnd();
  }

  // Cleanup observers
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.clearMetrics();
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = React.useState([]);

  React.useEffect(() => {
    performanceMonitor.setupWebVitals();
    
    return () => {
      performanceMonitor.cleanup();
    };
  }, []);

  const startTiming = React.useCallback((label) => {
    return performanceMonitor.startTiming(label);
  }, []);

  const endTiming = React.useCallback((label) => {
    const duration = performanceMonitor.endTiming(label);
    setMetrics(performanceMonitor.getMetrics());
    return duration;
  }, []);

  const generateReport = React.useCallback(() => {
    performanceMonitor.generateReport();
  }, []);

  return {
    startTiming,
    endTiming,
    generateReport,
    metrics
  };
}

// HOC for monitoring component performance
export function withPerformanceMonitoring(WrappedComponent, componentName) {
  const MonitoredComponent = React.memo((props) => {
    return performanceMonitor.monitorComponentRender(
      componentName || WrappedComponent.displayName || WrappedComponent.name,
      () => React.createElement(WrappedComponent, props)
    );
  });

  MonitoredComponent.displayName = `withPerformanceMonitoring(${componentName || WrappedComponent.displayName || WrappedComponent.name})`;
  
  return MonitoredComponent;
}

// Utility functions
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

// Memory usage monitoring
export const monitorMemoryUsage = () => {
  if (typeof window === 'undefined' || !window.performance?.memory) return;

  const memory = window.performance.memory;
  const used = Math.round(memory.usedJSHeapSize / 1048576);
  const total = Math.round(memory.totalJSHeapSize / 1048576);
  const limit = Math.round(memory.jsHeapSizeLimit / 1048576);

  console.log(`💾 Memory Usage: ${used}MB / ${total}MB (Limit: ${limit}MB)`);
  
  if (used / limit > 0.8) {
    console.warn('⚠️ High memory usage detected!');
  }
};

// Bundle size analyzer
export const analyzeBundleSize = () => {
  if (typeof window === 'undefined') return;

  const scripts = Array.from(document.querySelectorAll('script[src]'));
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));

  console.group('📦 Bundle Analysis');
  console.log(`Scripts loaded: ${scripts.length}`);
  console.log(`Stylesheets loaded: ${styles.length}`);
  
  scripts.forEach(script => {
    if (script.src.includes('_next/static')) {
      console.log(`📄 ${script.src.split('/').pop()}`);
    }
  });
  
  console.groupEnd();
};

export default performanceMonitor;