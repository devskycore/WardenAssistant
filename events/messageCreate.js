const { noPermissionEmbed, hasPermission } = require('../utils/permissions');
const PREFIX = (process.env.BOT_PREFIX || '$').trim();
const GUILD_ID = process.env.GUILD_ID;

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.guild || message.guild.id !== GUILD_ID) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);

    if (!command) return;

    if (!hasPermission(message)) {
      return message.reply({ embeds: [noPermissionEmbed(message.author)] });
    }

    try {
      await command.execute(message, args, client);
    } catch (error) {
      console.error(error);
      message.reply('❌ Ocurrió un error al ejecutar el comando.');
    }
  },
};
