/**
 * Monitoring Dashboard for Chat Interface
 * Provides real-time monitoring, health status, and performance metrics
 */

class MonitoringDashboard {
    constructor(configManager) {
        this.config = configManager;
        this.apiUrl = window.location.origin;
        this.isVisible = false;
        this.refreshTimer = null;
        this.healthData = null;
        this.metricsData = null;
        this.logBuffer = [];
        this.alertsBuffer = [];
        
        this.init();
    }

    /**
     * Initialize monitoring dashboard
     */
    init() {
        this.createDashboardHTML();
        this.attachEventListeners();
        
        if (this.config.isMonitoringEnabled()) {
            this.startMonitoring();
        }
        
        // Listen for config changes
        this.config.onConfigChange((config) => {
            if (config.monitoring?.enabled) {
                this.startMonitoring();
            } else {
                this.stopMonitoring();
            }
        });
    }

    /**
     * Create dashboard HTML structure
     */
    createDashboardHTML() {
        const dashboardHTML = `
            <div id="monitoring-dashboard" class="monitoring-dashboard hidden">
                <div class="dashboard-header">
                    <h3>🔍 System Monitoring</h3>
                    <div class="dashboard-controls">
                        <button id="refresh-monitoring" class="btn-icon" title="Refresh">
                            🔄
                        </button>
                        <button id="toggle-auto-refresh" class="btn-icon active" title="Auto-refresh">
                            ⏰
                        </button>
                        <button id="close-monitoring" class="btn-icon" title="Close">
                            ✖
                        </button>
                    </div>
                </div>
                
                <div class="dashboard-tabs">
                    <button class="tab-btn active" data-tab="health">🏥 Health</button>
                    <button class="tab-btn" data-tab="metrics">📊 Metrics</button>
                    <button class="tab-btn" data-tab="logs">📝 Logs</button>
                    <button class="tab-btn" data-tab="alerts">🚨 Alerts</button>
                </div>

                <div class="dashboard-content">
                    <!-- Health Tab -->
                    <div id="health-tab" class="tab-content active">
                        <div class="health-grid">
                            <div class="health-card">
                                <div class="health-title">System Status</div>
                                <div id="system-status" class="health-value">
                                    <span class="status-indicator unknown">❓</span>
                                    <span class="status-text">Checking...</span>
                                </div>
                            </div>
                            
                            <div class="health-card">
                                <div class="health-title">CPU Usage</div>
                                <div id="cpu-usage" class="health-value">
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: 0%"></div>
                                    </div>
                                    <span class="metric-text">0%</span>
                                </div>
                            </div>
                            
                            <div class="health-card">
                                <div class="health-title">Memory Usage</div>
                                <div id="memory-usage" class="health-value">
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: 0%"></div>
                                    </div>
                                    <span class="metric-text">0%</span>
                                </div>
                            </div>
                            
                            <div class="health-card">
                                <div class="health-title">Models Loaded</div>
                                <div id="models-loaded" class="health-value">
                                    <span class="counter">0</span>
                                    <span class="unit">models</span>
                                </div>
                            </div>
                            
                            <div class="health-card">
                                <div class="health-title">Response Time</div>
                                <div id="response-time" class="health-value">
                                    <span class="counter">0</span>
                                    <span class="unit">ms</span>
                                </div>
                            </div>
                            
                            <div class="health-card">
                                <div class="health-title">Error Rate</div>
                                <div id="error-rate" class="health-value">
                                    <span class="counter">0</span>
                                    <span class="unit">%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Metrics Tab -->
                    <div id="metrics-tab" class="tab-content">
                        <div class="metrics-container">
                            <div class="metric-group">
                                <h4>Request Metrics</h4>
                                <div class="metric-row">
                                    <span>Total Requests:</span>
                                    <span id="total-requests">0</span>
                                </div>
                                <div class="metric-row">
                                    <span>Successful:</span>
                                    <span id="successful-requests">0</span>
                                </div>
                                <div class="metric-row">
                                    <span>Failed:</span>
                                    <span id="failed-requests">0</span>
                                </div>
                                <div class="metric-row">
                                    <span>Avg Response Time:</span>
                                    <span id="avg-response-time">0ms</span>
                                </div>
                            </div>
                            
                            <div class="metric-group">
                                <h4>Model Performance</h4>
                                <div class="metric-row">
                                    <span>Total Inferences:</span>
                                    <span id="total-inferences">0</span>
                                </div>
                                <div class="metric-row">
                                    <span>Tokens Generated:</span>
                                    <span id="tokens-generated">0</span>
                                </div>
                                <div class="metric-row">
                                    <span>Cache Hits:</span>
                                    <span id="cache-hits">0</span>
                                </div>
                                <div class="metric-row">
                                    <span>Avg Tokens/sec:</span>
                                    <span id="tokens-per-second">0</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Logs Tab -->
                    <div id="logs-tab" class="tab-content">
                        <div class="logs-header">
                            <div class="log-controls">
                                <select id="log-level-filter">
                                    <option value="all">All Levels</option>
                                    <option value="error">Error</option>
                                    <option value="warn">Warning</option>
                                    <option value="info">Info</option>
                                    <option value="debug">Debug</option>
                                </select>
                                <button id="clear-logs" class="btn-small">Clear</button>
                            </div>
                        </div>
                        <div id="logs-container" class="logs-container">
                            <div class="log-entry">
                                <span class="log-time">${new Date().toLocaleTimeString()}</span>
                                <span class="log-level info">INFO</span>
                                <span class="log-message">Monitoring dashboard initialized</span>
                            </div>
                        </div>
                    </div>

                    <!-- Alerts Tab -->
                    <div id="alerts-tab" class="tab-content">
                        <div class="alerts-header">
                            <div class="alert-summary">
                                <span id="active-alerts-count">0</span> active alerts
                            </div>
                            <button id="clear-alerts" class="btn-small">Clear All</button>
                        </div>
                        <div id="alerts-container" class="alerts-container">
                            <div class="no-alerts">No active alerts</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add to page
        document.body.insertAdjacentHTML('beforeend', dashboardHTML);
        
        // Add CSS
        this.addDashboardCSS();
    }

    /**
     * Add CSS styles for monitoring dashboard
     */
    addDashboardCSS() {
        const cssId = 'monitoring-dashboard-css';
        if (document.getElementById(cssId)) return;

        const css = `
            .monitoring-dashboard {
                position: fixed;
                top: 10px;
                right: 10px;
                width: 400px;
                max-height: 600px;
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 1000;
                font-family: 'Segoe UI', monospace;
                color: #fff;
                overflow: hidden;
            }
            
            .monitoring-dashboard.hidden {
                display: none;
            }
            
            .dashboard-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: #2d2d2d;
                border-bottom: 1px solid #333;
            }
            
            .dashboard-header h3 {
                margin: 0;
                font-size: 14px;
                color: #4CAF50;
            }
            
            .dashboard-controls {
                display: flex;
                gap: 8px;
            }
            
            .btn-icon {
                background: none;
                border: none;
                color: #ccc;
                cursor: pointer;
                font-size: 14px;
                padding: 4px;
                border-radius: 3px;
                transition: background 0.2s;
            }
            
            .btn-icon:hover {
                background: #444;
            }
            
            .btn-icon.active {
                color: #4CAF50;
            }
            
            .dashboard-tabs {
                display: flex;
                background: #222;
                border-bottom: 1px solid #333;
            }
            
            .tab-btn {
                flex: 1;
                background: none;
                border: none;
                color: #ccc;
                padding: 8px 4px;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.2s;
            }
            
            .tab-btn:hover {
                background: #333;
                color: #fff;
            }
            
            .tab-btn.active {
                background: #4CAF50;
                color: #fff;
            }
            
            .dashboard-content {
                height: 400px;
                overflow-y: auto;
            }
            
            .tab-content {
                display: none;
                padding: 16px;
            }
            
            .tab-content.active {
                display: block;
            }
            
            .health-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }
            
            .health-card {
                background: #252525;
                border: 1px solid #333;
                border-radius: 6px;
                padding: 12px;
            }
            
            .health-title {
                font-size: 11px;
                color: #999;
                margin-bottom: 6px;
            }
            
            .health-value {
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .status-indicator {
                font-size: 12px;
            }
            
            .status-indicator.healthy {
                color: #4CAF50;
            }
            
            .status-indicator.warning {
                color: #FF9800;
            }
            
            .status-indicator.critical {
                color: #F44336;
            }
            
            .status-indicator.unknown {
                color: #757575;
            }
            
            .progress-bar {
                flex: 1;
                height: 6px;
                background: #333;
                border-radius: 3px;
                overflow: hidden;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #4CAF50, #8BC34A);
                transition: width 0.3s ease;
            }
            
            .progress-fill.warning {
                background: linear-gradient(90deg, #FF9800, #FFC107);
            }
            
            .progress-fill.critical {
                background: linear-gradient(90deg, #F44336, #FF5722);
            }
            
            .metric-text {
                font-size: 11px;
                color: #ccc;
                min-width: 35px;
            }
            
            .counter {
                font-weight: bold;
                color: #4CAF50;
            }
            
            .unit {
                font-size: 10px;
                color: #999;
            }
            
            .metrics-container {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            
            .metric-group h4 {
                margin: 0 0 8px 0;
                font-size: 12px;
                color: #4CAF50;
                border-bottom: 1px solid #333;
                padding-bottom: 4px;
            }
            
            .metric-row {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                font-size: 11px;
            }
            
            .metric-row span:first-child {
                color: #ccc;
            }
            
            .metric-row span:last-child {
                color: #fff;
                font-weight: bold;
            }
            
            .logs-header, .alerts-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid #333;
            }
            
            .log-controls, .alert-summary {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 11px;
            }
            
            .btn-small {
                background: #333;
                border: 1px solid #555;
                color: #ccc;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
            }
            
            .btn-small:hover {
                background: #444;
                color: #fff;
            }
            
            .logs-container, .alerts-container {
                height: 300px;
                overflow-y: auto;
                background: #1e1e1e;
                border: 1px solid #333;
                border-radius: 4px;
                padding: 8px;
            }
            
            .log-entry {
                display: flex;
                gap: 8px;
                padding: 2px 0;
                font-size: 10px;
                font-family: monospace;
                border-bottom: 1px solid #2a2a2a;
            }
            
            .log-time {
                color: #666;
                min-width: 60px;
            }
            
            .log-level {
                min-width: 50px;
                text-align: center;
                border-radius: 2px;
                padding: 1px 4px;
            }
            
            .log-level.error {
                background: #F44336;
                color: #fff;
            }
            
            .log-level.warn {
                background: #FF9800;
                color: #fff;
            }
            
            .log-level.info {
                background: #2196F3;
                color: #fff;
            }
            
            .log-level.debug {
                background: #607D8B;
                color: #fff;
            }
            
            .log-message {
                color: #ccc;
                flex: 1;
            }
            
            .no-alerts {
                text-align: center;
                color: #666;
                font-style: italic;
                padding: 20px;
            }
            
            .alert-item {
                background: #2a1a1a;
                border-left: 4px solid #F44336;
                padding: 8px;
                margin-bottom: 8px;
                border-radius: 0 4px 4px 0;
            }
            
            .alert-item.warning {
                border-left-color: #FF9800;
            }
            
            .alert-title {
                font-size: 11px;
                font-weight: bold;
                color: #F44336;
                margin-bottom: 4px;
            }
            
            .alert-title.warning {
                color: #FF9800;
            }
            
            .alert-message {
                font-size: 10px;
                color: #ccc;
            }
            
            .alert-time {
                font-size: 9px;
                color: #666;
                margin-top: 4px;
            }
        `;

        const style = document.createElement('style');
        style.id = cssId;
        style.textContent = css;
        document.head.appendChild(style);
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Dashboard controls
        document.getElementById('refresh-monitoring')?.addEventListener('click', () => {
            this.refreshData();
        });

        document.getElementById('toggle-auto-refresh')?.addEventListener('click', (e) => {
            const btn = e.target;
            if (this.refreshTimer) {
                this.stopMonitoring();
                btn.classList.remove('active');
            } else {
                this.startMonitoring();
                btn.classList.add('active');
            }
        });

        document.getElementById('close-monitoring')?.addEventListener('click', () => {
            this.hide();
        });

        // Log controls
        document.getElementById('log-level-filter')?.addEventListener('change', (e) => {
            this.filterLogs(e.target.value);
        });

        document.getElementById('clear-logs')?.addEventListener('click', () => {
            this.clearLogs();
        });

        document.getElementById('clear-alerts')?.addEventListener('click', () => {
            this.clearAlerts();
        });
    }

    /**
     * Switch active tab
     */
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    /**
     * Start monitoring with auto-refresh
     */
    startMonitoring() {
        if (this.refreshTimer) return;
        
        this.refreshData();
        this.refreshTimer = setInterval(() => {
            this.refreshData();
        }, this.config.getMonitoringRefreshInterval());
        
        this.addLog('info', 'Monitoring started');
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
            this.addLog('info', 'Monitoring stopped');
        }
    }

    /**
     * Refresh monitoring data
     */
    async refreshData() {
        try {
            await Promise.all([
                this.fetchHealthData(),
                this.fetchMetricsData()
            ]);
            this.updateDisplay();
        } catch (error) {
            this.addLog('error', `Failed to refresh monitoring data: ${error.message}`);
        }
    }

    /**
     * Fetch health data from server
     */
    async fetchHealthData() {
        try {
            const response = await fetch(`${this.apiUrl}/health`);
            if (response.ok) {
                this.healthData = await response.json();
            } else {
                throw new Error(`Health check failed: ${response.status}`);
            }
        } catch (error) {
            this.healthData = null;
            throw error;
        }
    }

    /**
     * Fetch metrics data from server
     */
    async fetchMetricsData() {
        try {
            const response = await fetch(`${this.apiUrl}/metrics`);
            if (response.ok) {
                const metricsText = await response.text();
                this.metricsData = this.parsePrometheusMetrics(metricsText);
            } else {
                throw new Error(`Metrics fetch failed: ${response.status}`);
            }
        } catch (error) {
            this.metricsData = null;
            throw error;
        }
    }

    /**
     * Parse Prometheus metrics format
     */
    parsePrometheusMetrics(text) {
        const metrics = {};
        const lines = text.split('\n');
        
        for (const line of lines) {
            if (line.startsWith('#') || !line.trim()) continue;
            
            const match = line.match(/^(\w+)(?:\{[^}]*\})?\s+([0-9.]+)/);
            if (match) {
                const [, name, value] = match;
                metrics[name] = parseFloat(value);
            }
        }
        
        return metrics;
    }

    /**
     * Update dashboard display
     */
    updateDisplay() {
        this.updateHealthDisplay();
        this.updateMetricsDisplay();
        this.checkAlerts();
    }

    /**
     * Update health status display
     */
    updateHealthDisplay() {
        if (!this.healthData) return;

        // System status
        const systemStatus = document.getElementById('system-status');
        const isHealthy = this.healthData.status === 'healthy';
        systemStatus.innerHTML = `
            <span class="status-indicator ${isHealthy ? 'healthy' : 'critical'}">
                ${isHealthy ? '✅' : '❌'}
            </span>
            <span class="status-text">${this.healthData.status || 'Unknown'}</span>
        `;

        // Update individual health metrics
        this.updateHealthCard('cpu-usage', this.healthData.checks?.cpu_usage);
        this.updateHealthCard('memory-usage', this.healthData.checks?.memory_usage);
        
        // Models loaded
        if (this.healthData.checks?.models) {
            document.querySelector('#models-loaded .counter').textContent = 
                this.healthData.checks.models.loaded || 0;
        }
    }

    /**
     * Update individual health card
     */
    updateHealthCard(id, data) {
        if (!data) return;

        const element = document.getElementById(id);
        const progressFill = element.querySelector('.progress-fill');
        const metricText = element.querySelector('.metric-text');
        
        if (progressFill && metricText) {
            const value = data.value || 0;
            const threshold = data.threshold || 100;
            const percentage = Math.min((value / threshold) * 100, 100);
            
            progressFill.style.width = `${percentage}%`;
            metricText.textContent = `${Math.round(value)}%`;
            
            // Update color based on threshold
            progressFill.className = 'progress-fill';
            if (percentage > 80) {
                progressFill.classList.add('critical');
            } else if (percentage > 60) {
                progressFill.classList.add('warning');
            }
        }
    }

    /**
     * Update metrics display
     */
    updateMetricsDisplay() {
        if (!this.metricsData) return;

        // Update metric values
        this.updateMetricValue('total-requests', this.metricsData.http_requests_total || 0);
        this.updateMetricValue('total-inferences', this.metricsData.model_inference_total || 0);
        this.updateMetricValue('tokens-generated', this.metricsData.model_tokens_generated_total || 0);
        this.updateMetricValue('cache-hits', this.metricsData.cache_hits_total || 0);
        
        // Calculate derived metrics
        const totalRequests = this.metricsData.http_requests_total || 0;
        const failedRequests = this.metricsData.http_requests_failed_total || 0;
        const successfulRequests = totalRequests - failedRequests;
        
        this.updateMetricValue('successful-requests', successfulRequests);
        this.updateMetricValue('failed-requests', failedRequests);
        
        // Response time
        const responseTime = this.metricsData.http_request_duration_seconds || 0;
        this.updateMetricValue('avg-response-time', `${Math.round(responseTime * 1000)}ms`);
        this.updateMetricValue('response-time', Math.round(responseTime * 1000));
        
        // Error rate
        const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
        this.updateMetricValue('error-rate', Math.round(errorRate * 100) / 100);
    }

    /**
     * Update individual metric value
     */
    updateMetricValue(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Check for alert conditions
     */
    checkAlerts() {
        const thresholds = this.config.getAlertThresholds();
        
        if (this.healthData) {
            // CPU usage alert
            const cpuUsage = this.healthData.checks?.cpu_usage?.value;
            if (cpuUsage && cpuUsage > thresholds.cpuUsage) {
                this.addAlert('warning', 'High CPU Usage', 
                    `CPU usage is ${Math.round(cpuUsage)}% (threshold: ${thresholds.cpuUsage}%)`);
            }
            
            // Memory usage alert
            const memUsage = this.healthData.checks?.memory_usage?.value;
            if (memUsage && memUsage > thresholds.memoryUsage) {
                this.addAlert('warning', 'High Memory Usage',
                    `Memory usage is ${Math.round(memUsage)}% (threshold: ${thresholds.memoryUsage}%)`);
            }
        }
        
        if (this.metricsData) {
            // Error rate alert
            const totalRequests = this.metricsData.http_requests_total || 0;
            const failedRequests = this.metricsData.http_requests_failed_total || 0;
            const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) : 0;
            
            if (errorRate > thresholds.errorRate) {
                this.addAlert('critical', 'High Error Rate',
                    `Error rate is ${Math.round(errorRate * 100)}% (threshold: ${thresholds.errorRate * 100}%)`);
            }
            
            // Response time alert
            const responseTime = this.metricsData.http_request_duration_seconds || 0;
            if (responseTime * 1000 > thresholds.responseTime) {
                this.addAlert('warning', 'High Response Time',
                    `Average response time is ${Math.round(responseTime * 1000)}ms (threshold: ${thresholds.responseTime}ms)`);
            }
        }
    }

    /**
     * Add log entry
     */
    addLog(level, message) {
        const logEntry = {
            time: new Date().toLocaleTimeString(),
            level: level,
            message: message,
            timestamp: Date.now()
        };
        
        this.logBuffer.unshift(logEntry);
        
        // Limit log buffer size
        const maxEntries = this.config.getMaxLogEntries();
        if (this.logBuffer.length > maxEntries) {
            this.logBuffer = this.logBuffer.slice(0, maxEntries);
        }
        
        this.updateLogsDisplay();
    }

    /**
     * Add alert
     */
    addAlert(severity, title, message) {
        // Check if alert already exists
        const existing = this.alertsBuffer.find(a => 
            a.title === title && a.message === message && 
            Date.now() - a.timestamp < 60000); // Don't duplicate within 1 minute
        
        if (existing) return;
        
        const alert = {
            severity: severity,
            title: title,
            message: message,
            timestamp: Date.now(),
            time: new Date().toLocaleTimeString()
        };
        
        this.alertsBuffer.unshift(alert);
        this.updateAlertsDisplay();
    }

    /**
     * Update logs display
     */
    updateLogsDisplay() {
        const container = document.getElementById('logs-container');
        if (!container) return;
        
        const levelFilter = document.getElementById('log-level-filter')?.value || 'all';
        const filteredLogs = levelFilter === 'all' 
            ? this.logBuffer 
            : this.logBuffer.filter(log => log.level === levelFilter);
        
        container.innerHTML = filteredLogs.map(log => `
            <div class="log-entry">
                <span class="log-time">${log.time}</span>
                <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
                <span class="log-message">${log.message}</span>
            </div>
        `).join('');
    }

    /**
     * Update alerts display
     */
    updateAlertsDisplay() {
        const container = document.getElementById('alerts-container');
        const countElement = document.getElementById('active-alerts-count');
        
        if (!container || !countElement) return;
        
        countElement.textContent = this.alertsBuffer.length;
        
        if (this.alertsBuffer.length === 0) {
            container.innerHTML = '<div class="no-alerts">No active alerts</div>';
            return;
        }
        
        container.innerHTML = this.alertsBuffer.map(alert => `
            <div class="alert-item ${alert.severity}">
                <div class="alert-title ${alert.severity}">${alert.title}</div>
                <div class="alert-message">${alert.message}</div>
                <div class="alert-time">${alert.time}</div>
            </div>
        `).join('');
    }

    /**
     * Filter logs by level
     */
    filterLogs(level) {
        this.updateLogsDisplay();
    }

    /**
     * Clear logs
     */
    clearLogs() {
        this.logBuffer = [];
        this.updateLogsDisplay();
    }

    /**
     * Clear alerts
     */
    clearAlerts() {
        this.alertsBuffer = [];
        this.updateAlertsDisplay();
    }

    /**
     * Show monitoring dashboard
     */
    show() {
        const dashboard = document.getElementById('monitoring-dashboard');
        if (dashboard) {
            dashboard.classList.remove('hidden');
            this.isVisible = true;
            
            if (this.config.isMonitoringEnabled() && !this.refreshTimer) {
                this.startMonitoring();
            }
        }
    }

    /**
     * Hide monitoring dashboard
     */
    hide() {
        const dashboard = document.getElementById('monitoring-dashboard');
        if (dashboard) {
            dashboard.classList.add('hidden');
            this.isVisible = false;
        }
    }

    /**
     * Toggle monitoring dashboard visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Cleanup and stop monitoring
     */
    destroy() {
        this.stopMonitoring();
        
        const dashboard = document.getElementById('monitoring-dashboard');
        if (dashboard) {
            dashboard.remove();
        }
        
        const css = document.getElementById('monitoring-dashboard-css');
        if (css) {
            css.remove();
        }
    }
}

// Export for use in other scripts
window.MonitoringDashboard = MonitoringDashboard;