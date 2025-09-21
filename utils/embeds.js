const { EmbedBuilder } = require('discord.js');
const { formatUptime } = require('./uptime');
const COLORS = require('./colors');

function makeStartupEmbed(client) {
  return new EmbedBuilder()
    .setTitle('⚡ Bot encendido')
    .setDescription(`¡Estoy **en línea** como **${client.user?.tag}** ✨`)
    .addFields(
      { name: '🔰 Estado', value: '🟢 Conectado', inline: true },
      { name: '🧭 Prefix', value: `\`${process.env.BOT_PREFIX || '$'}\``, inline: true },
      { name: '📡 Servidores', value: `${client.guilds.cache.size}`, inline: true },
    )
    .setColor(COLORS.success)
    .setTimestamp();
}

function makeShutdownEmbed(client, reason) {
  return new EmbedBuilder()
    .setTitle('🔻 Bot apagándose')
    .setDescription(`El bot **${client.user?.tag}** se está apagando. ${reason ? `Razón: ${reason}` : ''}`)
    .addFields(
      { name: '🔴 Estado', value: 'Desconectando', inline: true },
      { name: '⏱ Uptime', value: formatUptime(Math.floor(process.uptime())), inline: true },
    )
    .setColor(COLORS.error)
    .setTimestamp();
}

module.exports = { makeStartupEmbed, makeShutdownEmbed };
