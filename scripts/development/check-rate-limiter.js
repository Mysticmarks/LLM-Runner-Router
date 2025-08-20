import pkg from 'rate-limiter-flexible';
console.log('Available exports:', Object.keys(pkg));
console.log('RateLimiterMemory:', typeof pkg.RateLimiterMemory);
console.log('RateLimiterRedis:', typeof pkg.RateLimiterRedis);
console.log('RateLimiterFlexible:', typeof pkg.RateLimiterFlexible);