const { EmbedBuilder } = require('discord.js');
const { formatUptime } = require('../utils/uptime');
const COLORS = require('../utils/colors');

module.exports = {
  name: 'status',
  aliases: ['ping', 'estado'],
  description: 'Muestra el estado actual del bot',
  async execute(message, args, client) {
    const botLatency = Date.now() - message.createdTimestamp;
    const wsLatency = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
      .setTitle('📊 Estado del Bot')
      .setDescription(`Solicitado por ${message.author}`)
      .addFields(
        { name: '🏷 Bot Latency', value: `\`${botLatency} ms\``, inline: true },
        { name: '🌐 WS Latency', value: `\`${wsLatency} ms\``, inline: true },
        { name: '⏱ Uptime', value: formatUptime(Math.floor(process.uptime())), inline: true },
        { name: '📁 Memoria (RSS)', value: `\`${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB\``, inline: true },
      )
      .setColor(COLORS.status)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};
