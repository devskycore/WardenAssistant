const { makeShutdownEmbed } = require('../utils/embeds');
const { sendToConfiguredChannel } = require('../utils/queue');
const logger = require('../utils/logger');

async function gracefulShutdown(client, signal) {
  logger.warn(`Recibido ${signal}, apagando bot...`);
  try {
    await sendToConfiguredChannel(client, { embeds: [makeShutdownEmbed(client, signal)] });
  } catch (err) {
    logger.error(`Error enviando embed de apagado: ${err.message}`);
  } finally {
    try { await client.destroy(); } catch {}
    setTimeout(() => process.exit(0), 1200);
  }
}

process.once('SIGINT', () => gracefulShutdown(global.client, 'SIGINT'));
process.once('SIGTERM', () => gracefulShutdown(global.client, 'SIGTERM'));
