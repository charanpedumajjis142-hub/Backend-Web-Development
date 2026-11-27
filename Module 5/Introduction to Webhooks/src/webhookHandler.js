
'use strict';

const crypto = require('node:crypto');
const { handleEvent } = require('./eventHandlers');

// Stores event IDs that have already been received.
// The tests inspect this Set, so export it below.
const _processedIds = new Set();

function verifySignature(rawBody, signatureHeader, secret) {
  // Reject missing or incorrectly formatted signatures.
  if (
    !Buffer.isBuffer(rawBody) ||
    typeof signatureHeader !== 'string' ||
    typeof secret !== 'string' ||
    !secret
  ) {
    return false;
  }

  // Expected format: sha256=<64 hexadecimal characters>
  const match = signatureHeader.match(/^sha256=([a-fA-F0-9]{64})$/);

  if (!match) {
    return false;
  }

  // Calculate HMAC from the exact raw request bytes.
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest();

  const received = Buffer.from(match[1], 'hex');

  // timingSafeEqual requires buffers of the same length.
  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

function handleWebhook(req, res) {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  // 1. Verify signature before trusting or parsing the event.
  if (!verifySignature(req.body, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. Parse the JSON only after signature verification.
  let event;

  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (!event || !event.id) {
    return res.status(400).json({ error: 'Missing event id' });
  }

  // 3. Ignore events that have already been received.
  if (_processedIds.has(event.id)) {
    return res.status(200).json({
      status: 'already_processed',
    });
  }

  // 4. Mark it before scheduling any processing.
  _processedIds.add(event.id);

  // 5. Acknowledge immediately.
  res.status(200).json({ status: 'received' });

  // 6. Process after sending the response.
  setImmediate(() => {
    Promise.resolve(handleEvent(event)).catch((error) => {
      console.error('Webhook event processing failed:', error);
    });
  });
}

module.exports = {
  handleWebhook,
  _processedIds,
};
