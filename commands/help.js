const { EmbedBuilder } = require('discord.js');
const COLORS = require('../utils/colors');

module.exports = {
  name: 'help',
  aliases: [],
  description: 'Muestra la lista de comandos disponibles',
  async execute(message, args, client) {
    const embed = new EmbedBuilder()
      .setTitle('📖 Lista de comandos')
      .setDescription('Aquí tienes los comandos disponibles:')
      .addFields(
        { name: '📊 Estado del bot', value: '`status` (alias: `ping`, `estado`)', inline: false },
        { name: '📖 Ayuda', value: '`help`', inline: false },
      )
      .setColor(COLORS.success)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};
