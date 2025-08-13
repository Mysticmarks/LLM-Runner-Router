/**
 * Documentation System Configuration
 * Central configuration for the LLM Runner Router documentation system
 */

const DocsConfig = {
    // System Information
    system: {
        name: 'LLM Runner Router',
        version: '2.1.0',
        description: 'Universal Model Orchestration System',
        author: 'Echo AI Systems',
        repository: 'https://github.com/MCERQUA/LLM-Runner-Router',
        npm: 'https://www.npmjs.com/package/llm-runner-router',
        website: 'https://llm-runner-router.com',
        support: 'support@echoai.systems'
    },

    // Documentation Structure
    navigation: {
        'getting-started': {
            title: 'Getting Started',
            icon: 'fas fa-rocket',
            items: {
                'overview': {
                    title: 'Overview',
                    icon: 'fas fa-compass',
                    file: 'README.md',
                    description: 'Introduction and overview of the system'
                },
                'architecture': {
                    title: 'Architecture',
                    icon: 'fas fa-sitemap',
                    file: 'ARCHITECTURE.md',
                    description: 'System architecture and design principles'
                },
                'examples': {
                    title: 'Quick Examples',
                    icon: 'fas fa-code',
                    file: 'EXAMPLES.md',
                    description: 'Get started quickly with code examples'
                }
            }
        },
        'core-docs': {
            title: 'Core Documentation',
            icon: 'fas fa-book',
            items: {
                'api-reference': {
                    title: 'API Reference',
                    icon: 'fas fa-cogs',
                    file: 'API_REFERENCE.md',
                    description: 'Complete API documentation and reference'
                },
                'config-reference': {
                    title: 'Configuration',
                    icon: 'fas fa-sliders-h',
                    file: 'CONFIG_REFERENCE.md',
                    description: 'Configuration options and settings'
                },
                'routing-strategies': {
                    title: 'Routing Strategies',
                    icon: 'fas fa-route',
                    file: 'ROUTING_STRATEGIES.md',
                    description: 'Model routing and selection strategies'
                },
                'model-formats': {
                    title: 'Model Formats',
                    icon: 'fas fa-cube',
                    file: 'MODEL_FORMATS.md',
                    description: 'Supported model formats and loaders'
                },
                'performance': {
                    title: 'Performance',
                    icon: 'fas fa-tachometer-alt',
                    file: 'PERFORMANCE.md',
                    description: 'Performance optimization and benchmarks'
                }
            }
        },
        'examples-tutorials': {
            title: 'Examples & Tutorials',
            icon: 'fas fa-graduation-cap',
            items: {
                'basic-examples': {
                    title: 'Basic Usage',
                    icon: 'fas fa-play',
                    file: 'examples/BASIC.md',
                    description: 'Basic usage patterns and examples'
                },
                'streaming-examples': {
                    title: 'Streaming',
                    icon: 'fas fa-stream',
                    file: 'examples/STREAMING.md',
                    description: 'Real-time streaming examples'
                },
                'api-examples': {
                    title: 'Building APIs',
                    icon: 'fas fa-server',
                    file: 'examples/API.md',
                    description: 'Building REST APIs and services'
                },
                'docker-examples': {
                    title: 'Docker & Deployment',
                    icon: 'fab fa-docker',
                    file: 'examples/DOCKER.md',
                    description: 'Docker deployment and containerization'
                },
                'monitoring-examples': {
                    title: 'Monitoring',
                    icon: 'fas fa-chart-line',
                    file: 'examples/MONITORING.md',
                    description: 'Monitoring and observability examples'
                }
            }
        },
        'operations': {
            title: 'Operations',
            icon: 'fas fa-tools',
            items: {
                'deployment': {
                    title: 'Deployment',
                    icon: 'fas fa-rocket',
                    file: 'DEPLOYMENT.md',
                    description: 'Production deployment guide'
                },
                'security': {
                    title: 'Security',
                    icon: 'fas fa-shield-alt',
                    file: 'SECURITY.md',
                    description: 'Security best practices and guidelines'
                },
                'troubleshooting': {
                    title: 'Troubleshooting',
                    icon: 'fas fa-wrench',
                    file: 'TROUBLESHOOTING.md',
                    description: 'Common issues and solutions'
                }
            }
        },
        'development': {
            title: 'Development',
            icon: 'fas fa-laptop-code',
            items: {
                'plugin-development': {
                    title: 'Plugin Development',
                    icon: 'fas fa-puzzle-piece',
                    file: 'PLUGIN_DEVELOPMENT.md',
                    description: 'Developing plugins and extensions'
                },
                'faq': {
                    title: 'FAQ',
                    icon: 'fas fa-question-circle',
                    file: 'FAQ.md',
                    description: 'Frequently asked questions'
                },
                'glossary': {
                    title: 'Glossary',
                    icon: 'fas fa-book-open',
                    file: 'GLOSSARY.md',
                    description: 'Terms and definitions'
                }
            }
        }
    },

    // Search Configuration
    search: {
        enabled: true,
        placeholder: 'Search documentation...',
        maxResults: 10,
        minQueryLength: 2,
        debounceMs: 300,
        highlightMatches: true,
        categories: {
            'getting-started': { weight: 1.5, label: 'Getting Started' },
            'core-docs': { weight: 2.0, label: 'Core Docs' },
            'examples-tutorials': { weight: 1.3, label: 'Examples' },
            'operations': { weight: 1.2, label: 'Operations' },
            'development': { weight: 1.0, label: 'Development' }
        }
    },

    // UI Configuration
    ui: {
        theme: {
            primary: '#22c55e',
            primaryDark: '#16a34a',
            primaryLight: '#86efac',
            secondary: '#f59e0b',
            background: '#f8fafc',
            surface: '#ffffff',
            textPrimary: '#1e293b',
            textSecondary: '#64748b',
            textMuted: '#94a3b8',
            border: '#e2e8f0',
            borderLight: '#f1f5f9'
        },
        sidebar: {
            width: '320px',
            collapsible: true,
            persistState: true
        },
        header: {
            height: '70px',
            showVersion: true,
            showThemeToggle: true,
            showSearchShortcut: true
        },
        content: {
            maxWidth: '900px',
            showReadingTime: true,
            showWordCount: true,
            showLastModified: true,
            showTableOfContents: true,
            showBreadcrumbs: true
        },
        footer: {
            showSocialLinks: true,
            showCopyright: true,
            customLinks: [
                { title: 'GitHub', url: 'https://github.com/MCERQUA/LLM-Runner-Router' },
                { title: 'NPM', url: 'https://www.npmjs.com/package/llm-runner-router' },
                { title: 'Support', url: 'mailto:support@echoai.systems' }
            ]
        }
    },

    // Performance Configuration
    performance: {
        caching: {
            enabled: true,
            strategy: 'stale-while-revalidate',
            maxAge: 3600000, // 1 hour
            maxEntries: 50
        },
        lazy: {
            images: true,
            codeBlocks: false,
            embeds: true
        },
        prefetch: {
            enabled: true,
            strategy: 'hover',
            delay: 100
        },
        compression: {
            enabled: true,
            algorithms: ['gzip', 'br']
        }
    },

    // Analytics Configuration
    analytics: {
        enabled: false, // Set to true when analytics are needed
        provider: 'custom',
        trackPageViews: true,
        trackSearchQueries: true,
        trackDownloads: true,
        trackOutboundLinks: true,
        customEvents: {
            docPageView: 'doc_page_view',
            docSearch: 'doc_search',
            docDownload: 'doc_download'
        }
    },

    // SEO Configuration
    seo: {
        siteName: 'LLM Runner Router Documentation',
        siteDescription: 'Comprehensive documentation for the Universal Model Orchestration System. Learn how to route between any AI model with blazing fast performance.',
        siteUrl: 'https://llm-runner-router.com',
        defaultImage: '/images/og-image.png',
        twitterHandle: '@EchoAISystems',
        keywords: [
            'LLM', 'AI', 'machine learning', 'model routing', 'neural networks',
            'GGUF', 'ONNX', 'WebGPU', 'WASM', 'model orchestration',
            'AI inference', 'model loading', 'JavaScript AI', 'Node.js AI'
        ],
        structured: {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            'name': 'LLM Runner Router',
            'applicationCategory': 'DeveloperApplication',
            'operatingSystem': 'Cross-platform',
            'description': 'Universal Model Orchestration System for AI models'
        }
    },

    // Accessibility Configuration
    a11y: {
        enabled: true,
        skipLinks: true,
        focusOutlines: true,
        reducedMotion: 'respect',
        highContrast: 'support',
        screenReader: {
            announcePageChanges: true,
            announceSearchResults: true,
            announceErrors: true
        },
        keyboard: {
            searchShortcut: 'Ctrl+K',
            navigationShortcuts: true,
            focusTrap: true
        }
    },

    // Development Configuration
    development: {
        debug: false,
        hotReload: false,
        showPerformanceMetrics: false,
        mockApi: false,
        logLevel: 'info'
    },

    // API Configuration
    api: {
        baseUrl: '/api/docs',
        endpoints: {
            document: '/api/docs/:docName',
            search: '/api/docs/search',
            list: '/api/docs',
            analytics: '/api/docs/analytics'
        },
        timeout: 30000,
        retries: 3,
        cache: true
    },

    // Feature Flags
    features: {
        offlineSupport: true,
        pwaSupport: true,
        darkMode: false, // TODO: Implement
        multiLanguage: false, // TODO: Implement
        comments: false, // TODO: Consider
        ratings: false, // TODO: Consider
        exportToPdf: false, // TODO: Consider
        printOptimized: true,
        socialShare: false // TODO: Consider
    },

    // Content Configuration
    content: {
        dateFormat: 'MMM DD, YYYY',
        readingSpeed: 200, // words per minute
        codeTheme: 'tomorrow-night',
        mathSupport: false,
        mermaidSupport: false, // TODO: Consider for diagrams
        embedSupport: {
            youtube: false,
            codepen: false,
            github: true
        }
    },

    // Error Handling
    errors: {
        showUserFriendlyMessages: true,
        reportErrors: false,
        fallbackContent: {
            pageNotFound: 'The requested documentation page could not be found.',
            networkError: 'Unable to load content. Please check your connection.',
            serverError: 'Documentation service is temporarily unavailable.'
        },
        retry: {
            enabled: true,
            maxAttempts: 3,
            backoffMs: 1000
        }
    }
};

// Utility functions for configuration access
DocsConfig.getNavItem = function(sectionKey, itemKey) {
    return this.navigation[sectionKey]?.items?.[itemKey];
};

DocsConfig.getAllNavItems = function() {
    const items = [];
    for (const [sectionKey, section] of Object.entries(this.navigation)) {
        for (const [itemKey, item] of Object.entries(section.items)) {
            items.push({
                ...item,
                key: itemKey,
                section: sectionKey,
                sectionTitle: section.title
            });
        }
    }
    return items;
};

DocsConfig.getFileMapping = function() {
    const mapping = {};
    for (const [sectionKey, section] of Object.entries(this.navigation)) {
        for (const [itemKey, item] of Object.entries(section.items)) {
            mapping[itemKey] = item.file;
        }
    }
    return mapping;
};

DocsConfig.isFeatureEnabled = function(feature) {
    return this.features[feature] === true;
};

DocsConfig.getThemeColor = function(colorName) {
    return this.ui.theme[colorName];
};

DocsConfig.getApiUrl = function(endpoint, params = {}) {
    let url = this.api.baseUrl + this.api.endpoints[endpoint];
    
    // Replace URL parameters
    for (const [key, value] of Object.entries(params)) {
        url = url.replace(`:${key}`, encodeURIComponent(value));
    }
    
    return url;
};

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DocsConfig;
}

if (typeof window !== 'undefined') {
    window.DocsConfig = DocsConfig;
}

export default DocsConfig;