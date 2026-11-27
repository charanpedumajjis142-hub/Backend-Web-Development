
'use strict';

require('dotenv').config();

const express = require('express');
const db = require('./db');
const { cacheGet, cacheSet, cacheDel } = require('./cache');

const app = express();

app.use(express.json());

const FEED_KEY = 'feed:trending';
const FEED_TTL = 60;

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// GET /feed — cache-aside
app.get('/feed', async (req, res) => {
  try {
    const start = Date.now();

    // 1. Check Redis first
    const cached = await cacheGet(FEED_KEY);

    // 2. Cache hit: return cached posts
    if (cached !== null) {
      console.log(`[feed] HIT ${Date.now() - start}ms`);

      return res
        .set('X-Cache', 'HIT')
        .json(cached);
    }

    // 3. Cache miss: query the database
    const posts = await db.getTrendingPosts();

    // 4. Save posts in Redis for 60 seconds
    await cacheSet(FEED_KEY, posts, FEED_TTL);

    console.log(`[feed] MISS ${Date.now() - start}ms`);

    // 5. Return the database result
    return res
      .set('X-Cache', 'MISS')
      .json(posts);
  } catch (err) {
    console.error('[feed] error:', err);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// POST /posts — create a post and invalidate the feed cache
app.post('/posts', async (req, res) => {
  try {
    const post = await db.createPost(req.body);

    // Remove the old cached feed after creating the post
    await cacheDel(FEED_KEY);

    return res.status(201).json(post);
  } catch (err) {
    console.error('[posts] error:', err);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server on http://localhost:${PORT}`);
  });
}

module.exports = { app };
