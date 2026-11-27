
'use strict';

const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  lazyConnect: true,
});

// Get data from Redis
// Returns null if the key is missing or Redis has an error
async function cacheGet(key) {
  try {
    const value = await redis.get(key);

    if (value === null) {
      return null;
    }

    return JSON.parse(value);
  } catch (error) {
    console.error('[cache] GET failed:', error.message);
    return null;
  }
}

// Store data in Redis with a TTL
async function cacheSet(key, data, ttlSeconds) {
  try {
    await redis.set(
      key,
      JSON.stringify(data),
      'EX',
      ttlSeconds
    );
  } catch (error) {
    console.error('[cache] SET failed:', error.message);
  }
}

// Delete data from Redis
async function cacheDel(key) {
  try {
    await redis.del(key);
  } catch (error) {
    console.error('[cache] DEL failed:', error.message);
  }
}

module.exports = {
  redis,
  cacheGet,
  cacheSet,
  cacheDel,
};
