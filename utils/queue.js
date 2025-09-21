const logger = require('./logger');
const { setTimeout: wait } = require('timers/promises');

class MessageQueue {
  constructor(rateLimitMs = 2000) {
    this.queue = [];
    this.sending = false;
    this.rateLimitMs = rateLimitMs;
  }

  async send(channel, payload) {
    this.queue.push({ channel, payload });
    if (!this.sending) {
      this.processQueue();
    }
  }

  async processQueue() {
    this.sending = true;
    while (this.queue.length > 0) {
      const { channel, payload } = this.queue.shift();
      try {
        await channel.send(payload);
      } catch (err) {
        logger.error(`❌ Error enviando mensaje: ${err.message}`);
      }
      await wait(this.rateLimitMs);
    }
    this.sending = false;
  }
}

// Instancia global de la cola
const globalQueue = new MessageQueue();

async function sendToConfiguredChannel(client, payload) {
  const CHANNEL_ID = process.env.CHANNEL_ID;
  if (!CHANNEL_ID) {
    return logger.warn('⚠️ CHANNEL_ID no configurado.');
  }
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (channel?.isTextBased()) {
      await globalQueue.send(channel, payload);
    }
  } catch (err) {
    logger.error(`❌ Error enviando al canal configurado: ${err.message}`);
  }
}

module.exports = { MessageQueue, sendToConfiguredChannel };
