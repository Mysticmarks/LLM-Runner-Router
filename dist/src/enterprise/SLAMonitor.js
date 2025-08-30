/**
 * 📊 SLA Monitor
 * Enterprise-grade Service Level Agreement monitoring and reporting
 * Echo AI Systems - Proactive SLA compliance and performance tracking
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';

const logger = new Logger('SLAMonitor');

/**
 * SLA metric types
 */
export const SLAMetricTypes = {
  UPTIME: 'uptime',
  LATENCY: 'latency',
  THROUGHPUT: 'throughput',
  ERROR_RATE: 'error_rate',
  AVAILABILITY: 'availability',
  RESPONSE_TIME: 'response_time',
  RECOVERY_TIME: 'recovery_time',
  RESOLUTION_TIME: 'resolution_time'
};

/**
 * SLA breach severity levels
 */
export const BreachSeverity = {
  WARNING: 'warning',    // Approaching SLA threshold
  MINOR: 'minor',        // Minor breach, within tolerance
  MAJOR: 'major',        // Significant breach
  CRITICAL: 'critical'   // Critical SLA failure
};

/**
 * SLA status types
 */
export const SLAStatus = {
  HEALTHY: 'healthy',
  WARNING: 'warning',
  BREACH: 'breach',
  CRITICAL: 'critical',
  UNKNOWN: 'unknown'
};

/**
 * Time window types
 */
export const TimeWindows = {
  MINUTE: '1m',
  FIVE_MINUTES: '5m',
  FIFTEEN_MINUTES: '15m',
  HOUR: '1h',
  DAY: '1d',
  WEEK: '1w',
  MONTH: '1M'
};

/**
 * SLA Monitor
 */
class SLAMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      alertingEnabled: config.alertingEnabled !== false,
      alertThresholds: {
        warning: 0.05,    // 5% threshold breach
        critical: 0.15    // 15% threshold breach
      },
      reportingInterval: config.reportingInterval || 300000, // 5 minutes
      retentionDays: config.retentionDays || 90,
      escalationRules: config.escalationRules || [],
      ...config
    };
    
    // SLA definitions
    this.slaDefinitions = new Map();
    
    // Metrics storage
    this.metrics = new Map(); // service -> metric type -> time series data
    this.currentMetrics = new Map(); // service -> current values
    
    // Breach tracking
    this.activeBreaches = new Map();
    this.breachHistory = [];
    
    // Alert management
    this.alertRules = new Map();
    this.sentAlerts = new Map(); // To prevent alert spam
    
    // Performance data
    this.performanceData = new Map();
    this.aggregatedMetrics = new Map();
    
    // Monitoring state
    this.isMonitoring = false;
    this.monitoringInterval = null;
    
    logger.info('📊 SLA Monitor initialized', {
      alerting: this.config.alertingEnabled,
      reporting: this.config.reportingInterval
    });
  }

  /**
   * Define SLA for a service
   * @param {object} slaConfig - SLA configuration
   */
  async defineSLA(slaConfig) {
    const sla = {
      id: slaConfig.id || this.generateSLAId(),
      serviceName: slaConfig.serviceName,
      description: slaConfig.description,
      
      // SLA targets
      targets: slaConfig.targets, // { metricType: { threshold, operator, timeWindow } }
      
      // Monitoring configuration
      monitoringEnabled: slaConfig.monitoringEnabled !== false,
      alertingEnabled: slaConfig.alertingEnabled !== false,
      
      // Time configuration
      timeWindow: slaConfig.timeWindow || TimeWindows.DAY,
      measurementInterval: slaConfig.measurementInterval || 60000, // 1 minute
      
      // Business impact
      businessImpact: slaConfig.businessImpact || 'medium',
      
      // Escalation
      escalationPolicy: slaConfig.escalationPolicy,
      
      // Metadata
      createdAt: new Date(),
      updatedAt: new Date(),
      ...slaConfig
    };
    
    // Validate SLA
    this.validateSLA(sla);
    
    // Store SLA
    this.slaDefinitions.set(sla.id, sla);
    
    // Initialize metrics storage for service
    if (!this.metrics.has(sla.serviceName)) {
      this.metrics.set(sla.serviceName, new Map());
      this.currentMetrics.set(sla.serviceName, new Map());
    }
    
    this.emit('sla-defined', sla);
    logger.info(`✅ SLA defined for ${sla.serviceName}: ${sla.description}`);
    
    return sla;
  }

  /**
   * Start monitoring
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('SLA monitoring already running');
      return;
    }
    
    this.isMonitoring = true;
    
    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCycle().catch(error => {
        logger.error('Monitoring cycle failed:', error);
      });
    }, this.config.reportingInterval);
    
    // Start performance data collection
    this.startPerformanceCollection();
    
    this.emit('monitoring-started');
    logger.info('🚀 SLA monitoring started');
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.stopPerformanceCollection();
    
    this.emit('monitoring-stopped');
    logger.info('🛑 SLA monitoring stopped');
  }

  /**
   * Record metric value
   * @param {string} serviceName - Service name
   * @param {string} metricType - Type of metric
   * @param {number} value - Metric value
   * @param {object} metadata - Additional metadata
   */
  async recordMetric(serviceName, metricType, value, metadata = {}) {
    const timestamp = Date.now();
    
    // Store in time series
    const serviceMetrics = this.metrics.get(serviceName) || new Map();
    const metricTimeSeries = serviceMetrics.get(metricType) || [];
    
    const dataPoint = {
      timestamp,
      value,
      metadata
    };
    
    metricTimeSeries.push(dataPoint);
    
    // Keep only recent data
    const cutoff = timestamp - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    const recentData = metricTimeSeries.filter(point => point.timestamp > cutoff);
    
    serviceMetrics.set(metricType, recentData);
    this.metrics.set(serviceName, serviceMetrics);
    
    // Update current metrics
    const currentServiceMetrics = this.currentMetrics.get(serviceName) || new Map();
    currentServiceMetrics.set(metricType, {
      value,
      timestamp,
      metadata
    });
    this.currentMetrics.set(serviceName, currentServiceMetrics);
    
    // Check for SLA breaches
    await this.checkSLACompliance(serviceName, metricType, value);
    
    this.emit('metric-recorded', {
      serviceName,
      metricType,
      value,
      timestamp,
      metadata
    });
  }

  /**
   * Get SLA status for service
   * @param {string} serviceName - Service name
   */
  async getSLAStatus(serviceName) {
    const slas = this.getSLAsForService(serviceName);
    if (slas.length === 0) {
      return { status: SLAStatus.UNKNOWN, message: 'No SLAs defined' };
    }
    
    let overallStatus = SLAStatus.HEALTHY;
    const details = [];
    
    for (const sla of slas) {
      const slaStatus = await this.evaluateSLA(sla);
      details.push(slaStatus);
      
      // Determine worst status
      if (slaStatus.status === SLAStatus.CRITICAL) {
        overallStatus = SLAStatus.CRITICAL;
      } else if (slaStatus.status === SLAStatus.BREACH && overallStatus !== SLAStatus.CRITICAL) {
        overallStatus = SLAStatus.BREACH;
      } else if (slaStatus.status === SLAStatus.WARNING && 
                 overallStatus === SLAStatus.HEALTHY) {
        overallStatus = SLAStatus.WARNING;
      }
    }
    
    return {
      serviceName,
      status: overallStatus,
      details,
      lastChecked: new Date()
    };
  }

  /**
   * Generate SLA report
   * @param {string} serviceName - Service name (optional)
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async generateSLAReport(serviceName = null, startDate, endDate) {
    const report = {
      generatedAt: new Date(),
      period: { startDate, endDate },
      services: []
    };
    
    const servicesToReport = serviceName ? [serviceName] : 
      Array.from(new Set(Array.from(this.slaDefinitions.values()).map(sla => sla.serviceName)));
    
    for (const service of servicesToReport) {
      const serviceReport = await this.generateServiceReport(service, startDate, endDate);
      report.services.push(serviceReport);
    }
    
    // Calculate overall statistics
    report.summary = this.calculateReportSummary(report.services);
    
    return report;
  }

  /**
   * Get breach history
   * @param {string} serviceName - Service name (optional)
   * @param {Date} startDate - Start date (optional)
   * @param {Date} endDate - End date (optional)
   */
  getBreachHistory(serviceName = null, startDate = null, endDate = null) {
    let breaches = [...this.breachHistory];
    
    if (serviceName) {
      breaches = breaches.filter(breach => breach.serviceName === serviceName);
    }
    
    if (startDate) {
      breaches = breaches.filter(breach => 
        new Date(breach.startTime) >= startDate
      );
    }
    
    if (endDate) {
      breaches = breaches.filter(breach => 
        new Date(breach.startTime) <= endDate
      );
    }
    
    return breaches.sort((a, b) => 
      new Date(b.startTime) - new Date(a.startTime)
    );
  }

  /**
   * Get current metrics for service
   * @param {string} serviceName - Service name
   */
  getCurrentMetrics(serviceName) {
    return this.currentMetrics.get(serviceName) || new Map();
  }

  /**
   * Get aggregated metrics
   * @param {string} serviceName - Service name
   * @param {string} metricType - Metric type
   * @param {string} timeWindow - Time window
   */
  async getAggregatedMetrics(serviceName, metricType, timeWindow = TimeWindows.HOUR) {
    const serviceMetrics = this.metrics.get(serviceName);
    if (!serviceMetrics) {
      return null;
    }
    
    const metricData = serviceMetrics.get(metricType);
    if (!metricData || metricData.length === 0) {
      return null;
    }
    
    const windowMs = this.parseTimeWindow(timeWindow);
    const now = Date.now();
    const startTime = now - windowMs;
    
    const relevantData = metricData.filter(point => 
      point.timestamp >= startTime && point.timestamp <= now
    );
    
    if (relevantData.length === 0) {
      return null;
    }
    
    const values = relevantData.map(point => point.value);
    
    return {
      serviceName,
      metricType,
      timeWindow,
      period: { start: new Date(startTime), end: new Date(now) },
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
      median: this.calculateMedian(values),
      p95: this.calculatePercentile(values, 95),
      p99: this.calculatePercentile(values, 99)
    };
  }

  /**
   * Set up alert rule
   * @param {object} ruleConfig - Alert rule configuration
   */
  async setupAlertRule(ruleConfig) {
    const rule = {
      id: ruleConfig.id || this.generateAlertRuleId(),
      serviceName: ruleConfig.serviceName,
      metricType: ruleConfig.metricType,
      threshold: ruleConfig.threshold,
      operator: ruleConfig.operator || 'greater_than', // greater_than, less_than, equals
      severity: ruleConfig.severity || BreachSeverity.WARNING,
      enabled: ruleConfig.enabled !== false,
      cooldownPeriod: ruleConfig.cooldownPeriod || 300000, // 5 minutes
      escalationDelay: ruleConfig.escalationDelay || 900000, // 15 minutes
      ...ruleConfig
    };
    
    this.alertRules.set(rule.id, rule);
    
    logger.info(`🚨 Alert rule created: ${rule.serviceName}.${rule.metricType}`);
    return rule;
  }

  // Private methods

  /**
   * Validate SLA configuration
   * @private
   */
  validateSLA(sla) {
    if (!sla.serviceName) {
      throw new Error('Service name is required');
    }
    
    if (!sla.targets || Object.keys(sla.targets).length === 0) {
      throw new Error('SLA targets are required');
    }
    
    for (const [metricType, target] of Object.entries(sla.targets)) {
      if (!Object.values(SLAMetricTypes).includes(metricType)) {
        throw new Error(`Invalid metric type: ${metricType}`);
      }
      
      if (typeof target.threshold !== 'number') {
        throw new Error(`Invalid threshold for ${metricType}`);
      }
      
      if (!['greater_than', 'less_than', 'equals'].includes(target.operator)) {
        throw new Error(`Invalid operator for ${metricType}: ${target.operator}`);
      }
    }
  }

  /**
   * Generate SLA ID
   * @private
   */
  generateSLAId() {
    return 'sla_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Generate alert rule ID
   * @private
   */
  generateAlertRuleId() {
    return 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Get SLAs for service
   * @private
   */
  getSLAsForService(serviceName) {
    return Array.from(this.slaDefinitions.values())
      .filter(sla => sla.serviceName === serviceName);
  }

  /**
   * Perform monitoring cycle
   * @private
   */
  async performMonitoringCycle() {
    const startTime = Date.now();
    
    try {
      // Check all SLAs
      for (const sla of this.slaDefinitions.values()) {
        if (sla.monitoringEnabled) {
          await this.evaluateSLA(sla);
        }
      }
      
      // Process alerts
      await this.processAlerts();
      
      // Update aggregated metrics
      await this.updateAggregatedMetrics();
      
      const duration = Date.now() - startTime;
      logger.debug(`📊 Monitoring cycle completed in ${duration}ms`);
      
    } catch (error) {
      logger.error('Monitoring cycle error:', error);
    }
  }

  /**
   * Check SLA compliance for a specific metric
   * @private
   */
  async checkSLACompliance(serviceName, metricType, value) {
    const slas = this.getSLAsForService(serviceName);
    
    for (const sla of slas) {
      const target = sla.targets[metricType];
      if (!target) {
        continue;
      }
      
      const isCompliant = this.evaluateTarget(value, target);
      
      if (!isCompliant) {
        await this.handleSLABreach(sla, metricType, value, target);
      } else {
        await this.handleSLARecovery(sla, metricType, value);
      }
    }
  }

  /**
   * Evaluate SLA
   * @private
   */
  async evaluateSLA(sla) {
    const serviceName = sla.serviceName;
    const results = {};
    let overallCompliance = true;
    
    for (const [metricType, target] of Object.entries(sla.targets)) {
      const aggregated = await this.getAggregatedMetrics(
        serviceName, 
        metricType, 
        target.timeWindow || sla.timeWindow
      );
      
      if (!aggregated) {
        results[metricType] = {
          status: SLAStatus.UNKNOWN,
          message: 'No data available'
        };
        continue;
      }
      
      const metricValue = this.getTargetValue(aggregated, target.aggregation || 'avg');
      const isCompliant = this.evaluateTarget(metricValue, target);
      
      results[metricType] = {
        status: isCompliant ? SLAStatus.HEALTHY : SLAStatus.BREACH,
        value: metricValue,
        threshold: target.threshold,
        compliance: isCompliant,
        aggregation: aggregated
      };
      
      if (!isCompliant) {
        overallCompliance = false;
      }
    }
    
    const slaStatus = {
      slaId: sla.id,
      serviceName,
      status: overallCompliance ? SLAStatus.HEALTHY : SLAStatus.BREACH,
      targets: results,
      evaluatedAt: new Date()
    };
    
    this.emit('sla-evaluated', slaStatus);
    
    return slaStatus;
  }

  /**
   * Evaluate target compliance
   * @private
   */
  evaluateTarget(value, target) {
    switch (target.operator) {
      case 'greater_than':
        return value > target.threshold;
      case 'less_than':
        return value < target.threshold;
      case 'equals':
        return Math.abs(value - target.threshold) < 0.001;
      case 'greater_than_or_equal':
        return value >= target.threshold;
      case 'less_than_or_equal':
        return value <= target.threshold;
      default:
        return false;
    }
  }

  /**
   * Get target value from aggregated metrics
   * @private
   */
  getTargetValue(aggregated, aggregationType) {
    switch (aggregationType) {
      case 'avg':
        return aggregated.avg;
      case 'min':
        return aggregated.min;
      case 'max':
        return aggregated.max;
      case 'median':
        return aggregated.median;
      case 'p95':
        return aggregated.p95;
      case 'p99':
        return aggregated.p99;
      default:
        return aggregated.avg;
    }
  }

  /**
   * Handle SLA breach
   * @private
   */
  async handleSLABreach(sla, metricType, value, target) {
    const breachId = `${sla.id}_${metricType}`;
    
    // Check if breach is already active
    if (this.activeBreaches.has(breachId)) {
      // Update existing breach
      const breach = this.activeBreaches.get(breachId);
      breach.currentValue = value;
      breach.duration = Date.now() - breach.startTime;
      return;
    }
    
    // Create new breach
    const breach = {
      id: breachId,
      slaId: sla.id,
      serviceName: sla.serviceName,
      metricType,
      startTime: Date.now(),
      currentValue: value,
      threshold: target.threshold,
      severity: this.calculateBreachSeverity(value, target),
      resolved: false
    };
    
    this.activeBreaches.set(breachId, breach);
    this.breachHistory.push({ ...breach });
    
    // Trigger alerts
    if (sla.alertingEnabled && this.config.alertingEnabled) {
      await this.triggerAlert(breach);
    }
    
    this.emit('sla-breach', breach);
    logger.warn(`⚠️ SLA breach: ${sla.serviceName}.${metricType} = ${value} (threshold: ${target.threshold})`);
  }

  /**
   * Handle SLA recovery
   * @private
   */
  async handleSLARecovery(sla, metricType, value) {
    const breachId = `${sla.id}_${metricType}`;
    const breach = this.activeBreaches.get(breachId);
    
    if (breach && !breach.resolved) {
      breach.resolved = true;
      breach.endTime = Date.now();
      breach.duration = breach.endTime - breach.startTime;
      breach.recoveryValue = value;
      
      this.activeBreaches.delete(breachId);
      
      this.emit('sla-recovery', breach);
      logger.info(`✅ SLA recovered: ${sla.serviceName}.${metricType} = ${value}`);
    }
  }

  /**
   * Calculate breach severity
   * @private
   */
  calculateBreachSeverity(value, target) {
    const threshold = target.threshold;
    let deviation;
    
    if (target.operator === 'greater_than' || target.operator === 'greater_than_or_equal') {
      deviation = (threshold - value) / threshold;
    } else {
      deviation = (value - threshold) / threshold;
    }
    
    if (Math.abs(deviation) > this.config.alertThresholds.critical) {
      return BreachSeverity.CRITICAL;
    } else if (Math.abs(deviation) > this.config.alertThresholds.warning) {
      return BreachSeverity.MAJOR;
    } else {
      return BreachSeverity.MINOR;
    }
  }

  /**
   * Trigger alert
   * @private
   */
  async triggerAlert(breach) {
    const alertKey = `${breach.serviceName}_${breach.metricType}`;
    const lastAlert = this.sentAlerts.get(alertKey);
    
    // Check cooldown period
    if (lastAlert && (Date.now() - lastAlert) < 300000) { // 5 minutes
      return;
    }
    
    const alert = {
      id: this.generateAlertId(),
      type: 'sla_breach',
      severity: breach.severity,
      serviceName: breach.serviceName,
      metricType: breach.metricType,
      message: `SLA breach: ${breach.serviceName}.${breach.metricType} = ${breach.currentValue} (threshold: ${breach.threshold})`,
      breach,
      timestamp: Date.now()
    };
    
    this.sentAlerts.set(alertKey, Date.now());
    
    this.emit('alert-triggered', alert);
    logger.error(`🚨 Alert: ${alert.message}`);
  }

  /**
   * Generate alert ID
   * @private
   */
  generateAlertId() {
    return 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Process alerts
   * @private
   */
  async processAlerts() {
    // Check for escalations
    for (const breach of this.activeBreaches.values()) {
      const duration = Date.now() - breach.startTime;
      
      // Check if breach requires escalation
      if (duration > 900000 && !breach.escalated) { // 15 minutes
        breach.escalated = true;
        await this.escalateBreach(breach);
      }
    }
  }

  /**
   * Escalate breach
   * @private
   */
  async escalateBreach(breach) {
    const escalation = {
      id: this.generateAlertId(),
      type: 'escalation',
      breach,
      escalatedAt: Date.now(),
      reason: 'Extended breach duration'
    };
    
    this.emit('breach-escalated', escalation);
    logger.error(`🔥 Breach escalated: ${breach.serviceName}.${breach.metricType}`);
  }

  /**
   * Generate service report
   * @private
   */
  async generateServiceReport(serviceName, startDate, endDate) {
    const slas = this.getSLAsForService(serviceName);
    const serviceReport = {
      serviceName,
      slas: [],
      summary: {
        totalSLAs: slas.length,
        compliantSLAs: 0,
        breachedSLAs: 0,
        totalBreaches: 0,
        worstPerformingMetric: null
      }
    };
    
    for (const sla of slas) {
      const slaReport = await this.generateSLAReport(sla, startDate, endDate);
      serviceReport.slas.push(slaReport);
      
      if (slaReport.overallCompliance) {
        serviceReport.summary.compliantSLAs++;
      } else {
        serviceReport.summary.breachedSLAs++;
      }
      
      serviceReport.summary.totalBreaches += slaReport.breachCount;
    }
    
    return serviceReport;
  }

  /**
   * Generate SLA report
   * @private
   */
  async generateSLAReport(sla, startDate, endDate) {
    const report = {
      slaId: sla.id,
      serviceName: sla.serviceName,
      description: sla.description,
      targets: {},
      overallCompliance: true,
      breachCount: 0,
      worstBreach: null
    };
    
    for (const [metricType, target] of Object.entries(sla.targets)) {
      const metricReport = await this.generateMetricReport(
        sla.serviceName, 
        metricType, 
        target, 
        startDate, 
        endDate
      );
      
      report.targets[metricType] = metricReport;
      
      if (!metricReport.compliance.overall) {
        report.overallCompliance = false;
      }
      
      report.breachCount += metricReport.breachCount;
      
      if (!report.worstBreach || 
          metricReport.worstBreach?.severity > report.worstBreach?.severity) {
        report.worstBreach = metricReport.worstBreach;
      }
    }
    
    return report;
  }

  /**
   * Generate metric report
   * @private
   */
  async generateMetricReport(serviceName, metricType, target, startDate, endDate) {
    const serviceMetrics = this.metrics.get(serviceName);
    const metricData = serviceMetrics?.get(metricType) || [];
    
    // Filter data by date range
    const filteredData = metricData.filter(point => {
      const pointDate = new Date(point.timestamp);
      return pointDate >= startDate && pointDate <= endDate;
    });
    
    if (filteredData.length === 0) {
      return {
        metricType,
        target,
        dataPoints: 0,
        compliance: { overall: true, percentage: 100 },
        breachCount: 0,
        worstBreach: null
      };
    }
    
    const values = filteredData.map(point => point.value);
    const compliantValues = values.filter(value => 
      this.evaluateTarget(value, target)
    );
    
    const compliancePercentage = (compliantValues.length / values.length) * 100;
    
    // Find breaches
    const breaches = this.getBreachHistory(serviceName, startDate, endDate)
      .filter(breach => breach.metricType === metricType);
    
    const worstBreach = breaches.length > 0 ? 
      breaches.reduce((worst, current) => 
        current.severity > worst.severity ? current : worst
      ) : null;
    
    return {
      metricType,
      target,
      dataPoints: filteredData.length,
      statistics: {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((sum, val) => sum + val, 0) / values.length,
        median: this.calculateMedian(values)
      },
      compliance: {
        overall: compliancePercentage >= target.minimumCompliance || 95,
        percentage: compliancePercentage
      },
      breachCount: breaches.length,
      worstBreach
    };
  }

  /**
   * Calculate report summary
   * @private
   */
  calculateReportSummary(serviceReports) {
    const summary = {
      totalServices: serviceReports.length,
      totalSLAs: 0,
      compliantSLAs: 0,
      breachedSLAs: 0,
      totalBreaches: 0,
      overallCompliance: 0
    };
    
    for (const serviceReport of serviceReports) {
      summary.totalSLAs += serviceReport.summary.totalSLAs;
      summary.compliantSLAs += serviceReport.summary.compliantSLAs;
      summary.breachedSLAs += serviceReport.summary.breachedSLAs;
      summary.totalBreaches += serviceReport.summary.totalBreaches;
    }
    
    summary.overallCompliance = summary.totalSLAs > 0 ? 
      (summary.compliantSLAs / summary.totalSLAs) * 100 : 100;
    
    return summary;
  }

  /**
   * Parse time window string to milliseconds
   * @private
   */
  parseTimeWindow(timeWindow) {
    const timeMap = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000
    };
    
    return timeMap[timeWindow] || timeMap['1h'];
  }

  /**
   * Calculate median value
   * @private
   */
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0 ? 
      (sorted[mid - 1] + sorted[mid]) / 2 : 
      sorted[mid];
  }

  /**
   * Calculate percentile
   * @private
   */
  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Start performance data collection
   * @private
   */
  startPerformanceCollection() {
    // This would integrate with system monitoring
    // For demo purposes, we'll simulate some basic collection
    logger.debug('📈 Performance data collection started');
  }

  /**
   * Stop performance data collection
   * @private
   */
  stopPerformanceCollection() {
    logger.debug('📈 Performance data collection stopped');
  }

  /**
   * Update aggregated metrics
   * @private
   */
  async updateAggregatedMetrics() {
    // Update aggregated metrics for faster reporting
    // This would be done in a background process in production
    logger.debug('📊 Updated aggregated metrics');
  }
}

export default SLAMonitor;
export { SLAMonitor };