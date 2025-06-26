/**
 * Performance Monitor Component
 * مراقب الأداء - يعرض معلومات الأداء في وضع التطوير
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePerformanceMonitor } from '@/utils/performance';

const PerformanceMonitor = () => {
  const { metrics, generateReport } = usePerformanceMonitor();
  const [isVisible, setIsVisible] = useState(false);
  const [memoryInfo, setMemoryInfo] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);

  // Only show in development
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Memory monitoring
  const updateMemoryInfo = useCallback(() => {
    if (typeof window !== 'undefined' && window.performance?.memory) {
      const memory = window.performance.memory;
      setMemoryInfo({
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
      });
    }
  }, []);

  // Network monitoring
  const updateNetworkInfo = useCallback(() => {
    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const connection = navigator.connection;
      setNetworkInfo({
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      });
    }
  }, []);

  // Performance metrics calculations
  const performanceStats = useMemo(() => {
    if (!metrics.length) return null;

    const completedMetrics = metrics.filter(m => m.duration !== null);
    const totalTime = completedMetrics.reduce((sum, m) => sum + m.duration, 0);
    const avgTime = totalTime / completedMetrics.length;
    const slowOperations = completedMetrics.filter(m => m.duration > 1000);
    const fastOperations = completedMetrics.filter(m => m.duration < 100);

    return {
      total: completedMetrics.length,
      totalTime: totalTime.toFixed(2),
      avgTime: avgTime.toFixed(2),
      slowCount: slowOperations.length,
      fastCount: fastOperations.length,
      slowest: completedMetrics.reduce((max, m) => 
        m.duration > max.duration ? m : max, completedMetrics[0]
      ),
    };
  }, [metrics]);

  useEffect(() => {
    if (!isDevelopment) return;

    // Update memory and network info periodically
    const interval = setInterval(() => {
      updateMemoryInfo();
      updateNetworkInfo();
    }, 2000);

    // Initial update
    updateMemoryInfo();
    updateNetworkInfo();

    return () => clearInterval(interval);
  }, [isDevelopment, updateMemoryInfo, updateNetworkInfo]);

  // Keyboard shortcut to toggle visibility
  useEffect(() => {
    if (!isDevelopment) return;

    const handleKeyPress = (e) => {
      // Ctrl + Shift + P to toggle performance monitor
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isDevelopment]);

  if (!isDevelopment) return null;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-colors"
        title="Toggle Performance Monitor (Ctrl+Shift+P)"
      >
        📊
      </button>

      {/* Performance Monitor Panel */}
      {isVisible && (
        <div className="fixed bottom-16 right-4 z-50 bg-gray-900 text-white p-4 rounded-lg shadow-xl max-w-sm w-full max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-bold">⚡ Performance Monitor</h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Memory Information */}
          {memoryInfo && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">💾 Memory Usage</h4>
              <div className="text-xs space-y-1">
                <div>Used: {memoryInfo.used}MB</div>
                <div>Total: {memoryInfo.total}MB</div>
                <div>Limit: {memoryInfo.limit}MB</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      memoryInfo.used / memoryInfo.limit > 0.8
                        ? 'bg-red-500'
                        : memoryInfo.used / memoryInfo.limit > 0.6
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{
                      width: `${(memoryInfo.used / memoryInfo.limit) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Network Information */}
          {networkInfo && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">🌐 Network</h4>
              <div className="text-xs space-y-1">
                <div>Type: {networkInfo.effectiveType}</div>
                <div>Speed: {networkInfo.downlink} Mbps</div>
                <div>RTT: {networkInfo.rtt}ms</div>
                {networkInfo.saveData && (
                  <div className="text-yellow-400">Data Saver: ON</div>
                )}
              </div>
            </div>
          )}

          {/* Performance Statistics */}
          {performanceStats && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">📈 Performance Stats</h4>
              <div className="text-xs space-y-1">
                <div>Operations: {performanceStats.total}</div>
                <div>Total Time: {performanceStats.totalTime}ms</div>
                <div>Avg Time: {performanceStats.avgTime}ms</div>
                <div className="flex justify-between">
                  <span>Fast (&lt;100ms):</span>
                  <span className="text-green-400">{performanceStats.fastCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Slow (&gt;1s):</span>
                  <span className="text-red-400">{performanceStats.slowCount}</span>
                </div>
                {performanceStats.slowest && (
                  <div className="text-yellow-400">
                    Slowest: {performanceStats.slowest.label} ({performanceStats.slowest.duration.toFixed(2)}ms)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Metrics */}
          {metrics.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">📊 Recent Operations</h4>
              <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
                {metrics.slice(-5).reverse().map((metric, index) => (
                  <div
                    key={index}
                    className={`flex justify-between ${
                      metric.duration > 1000
                        ? 'text-red-400'
                        : metric.duration > 500
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}
                  >
                    <span className="truncate mr-2">{metric.label}</span>
                    <span>
                      {metric.duration ? `${metric.duration.toFixed(2)}ms` : 'Running...'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={generateReport}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded text-xs transition-colors"
            >
              Generate Report
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.performance?.mark) {
                  window.performance.mark('user-action');
                }
              }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded text-xs transition-colors"
            >
              Mark Event
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-3 text-xs text-gray-400">
            Press Ctrl+Shift+P to toggle this panel
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(PerformanceMonitor);