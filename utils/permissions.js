const { EmbedBuilder } = require('discord.js');
const COLORS = require('./colors');

function noPermissionEmbed(user) {
  return new EmbedBuilder()
    .setTitle('⛔ Acceso denegado')
    .setDescription(`Lo siento ${user}, no tienes permisos para ejecutar este comando.`)
    .setColor(COLORS.error)
    .setTimestamp();
}

function hasPermission(message) {
  const ROLE_ID = process.env.ROLE_ID || '1418329077751873568';
  const DEV_ID = process.env.DEV_ID || '1407964057901731850';
  const isAdminRole = message.member?.roles.cache.has(ROLE_ID);
  const isDevUser = message.author.id === DEV_ID;
  return isAdminRole && isDevUser;
}

module.exports = { noPermissionEmbed, hasPermission };
