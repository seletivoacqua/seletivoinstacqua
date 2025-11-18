interface RequestMetric {
  action: string;
  duration: number;
  cached: boolean;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: RequestMetric[] = [];
  private maxMetrics = 1000;
  private enabled = true;

  logRequest(action: string, duration: number, cached: boolean): void {
    if (!this.enabled) return;

    const metric: RequestMetric = {
      action,
      duration,
      cached,
      timestamp: Date.now()
    };

    this.metrics.push(metric);

    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    console.log(
      `[PERF] ${action}: ${duration}ms ${cached ? '✅ (cached)' : '🌐 (network)'}`
    );
  }

  getMetrics(): {
    totalRequests: number;
    cacheHitRate: number;
    averageLatency: number;
    networkLatency: number;
    cacheLatency: number;
  } {
    if (this.metrics.length === 0) {
      return {
        totalRequests: 0,
        cacheHitRate: 0,
        averageLatency: 0,
        networkLatency: 0,
        cacheLatency: 0
      };
    }

    const cachedRequests = this.metrics.filter(m => m.cached);
    const networkRequests = this.metrics.filter(m => !m.cached);

    const totalLatency = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const cacheLatency = cachedRequests.reduce((sum, m) => sum + m.duration, 0);
    const networkLatency = networkRequests.reduce((sum, m) => sum + m.duration, 0);

    return {
      totalRequests: this.metrics.length,
      cacheHitRate: (cachedRequests.length / this.metrics.length) * 100,
      averageLatency: totalLatency / this.metrics.length,
      networkLatency: networkRequests.length > 0 ? networkLatency / networkRequests.length : 0,
      cacheLatency: cachedRequests.length > 0 ? cacheLatency / cachedRequests.length : 0
    };
  }

  getRecentMetrics(seconds: number = 60): RequestMetric[] {
    const cutoff = Date.now() - seconds * 1000;
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }

  clear(): void {
    this.metrics = [];
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  printStats(): void {
    const stats = this.getMetrics();
    console.group('📊 Performance Statistics');
    console.log(`Total Requests: ${stats.totalRequests}`);
    console.log(`Cache Hit Rate: ${stats.cacheHitRate.toFixed(1)}%`);
    console.log(`Average Latency: ${stats.averageLatency.toFixed(0)}ms`);
    console.log(`Network Latency: ${stats.networkLatency.toFixed(0)}ms`);
    console.log(`Cache Latency: ${stats.cacheLatency.toFixed(0)}ms`);
    console.groupEnd();
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Expor globalmente para debug
if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = performanceMonitor;
}
