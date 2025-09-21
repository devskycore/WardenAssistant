const { rotatePresence } = require('../utils/presence');
const { makeStartupEmbed } = require('../utils/embeds');
const { sendToConfiguredChannel } = require('../utils/queue');
const logger = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`✅ Bot listo como ${client.user.tag}`);
    rotatePresence(client, process.env.PRESENCE_INTERVAL || 5 * 60 * 1000);
    await sendToConfiguredChannel(client, { embeds: [makeStartupEmbed(client)] });
  },
};
