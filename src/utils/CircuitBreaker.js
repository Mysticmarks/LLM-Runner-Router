/**
 * Circuit Breaker Implementation
 * Provides fault tolerance by detecting failures and preventing cascading failures
 */

import { EventEmitter } from 'events';

export class CircuitBreaker extends EventEmitter {
  constructor(fn, options = {}) {
    super();
    this.fn = fn;
    this.options = {
      timeout: options.timeout || 5000,
      errorThreshold: options.errorThreshold || 50,
      resetTimeout: options.resetTimeout || 30000,
      volumeThreshold: options.volumeThreshold || 10,
      ...options
    };
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
  }

  async call(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }
    
    this.requestCount++;
    
    try {
      const result = await Promise.race([
        this.fn(...args),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Circuit breaker timeout')), this.options.timeout)
        )
      ]);
      
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.successCount++;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.emit('close');
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.requestCount >= this.options.volumeThreshold) {
      const errorRate = (this.failureCount / this.requestCount) * 100;
      
      if (errorRate >= this.options.errorThreshold) {
        this.trip();
      }
    }
  }

  trip() {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.options.resetTimeout;
    this.emit('open');
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    this.emit('reset');
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

export default CircuitBreaker;