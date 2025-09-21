const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const dotenv = require('dotenv');

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PREFIX = (process.env.BOT_PREFIX || '$').trim();

if (!DISCORD_TOKEN) {
  console.error('⛔ DISCORD_TOKEN no está configurado en .env. Salida.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function makeStartupEmbed(client) {
  return new EmbedBuilder()
    .setTitle('⚡ Bot encendido')
    .setDescription(`¡Hola! Estoy **en línea** como **${client.user?.tag || 'Desconocido'}** \n\nGracias por usarme ✨`)
    .addFields(
      { name: '🔰 Estado', value: '🟢 Conectado', inline: true },
      { name: '🧭 Prefix', value: `\`${PREFIX}\``, inline: true },
      { name: '📡 Servidores', value: `${client.guilds.cache.size}`, inline: true },
    )
    .setTimestamp()
    .setColor(0x57F287)
    .setFooter({ text: 'Mensaje automático — inicio', iconURL: client.user?.displayAvatarURL() });
}

function makeShutdownEmbed(client, reason) {
  return new EmbedBuilder()
    .setTitle('🔻 Bot apagándose')
    .setDescription(`El bot **${client.user?.tag || 'desconocido'}** se está apagando. ${reason ? `Reason: ${reason}` : ''}`)
    .addFields(
      { name: '🔴 Estado', value: 'Desconectando', inline: true },
      { name: '⏱ Uptime (s)', value: `${Math.floor(process.uptime())}`, inline: true },
    )
    .setTimestamp()
    .setColor(0xED4245)
    .setFooter({ text: 'Mensaje automático — apagado', iconURL: client.user?.displayAvatarURL() });
}

async function sendToConfiguredChannel(payload) {
  if (!CHANNEL_ID) {
    console.warn('⚠️ CHANNEL_ID no configurado. No se enviará el mensaje de estado.');
    return;
  }
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (channel && channel.isTextBased && channel.isTextBased()) {
      await channel.send(payload);
    }
  } catch (err) {
    console.error('❌ Error enviando mensaje al canal configurado:', err);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ ¡Bot listo! Conectado como ${c.user.tag}`);
  try {
    await client.user.setPresence({ activities: [{ name: `${PREFIX}ping | ${client.guilds.cache.size} servers` }], status: 'online' });
  } catch {}
  const startupEmbed = makeStartupEmbed(client);
  await sendToConfiguredChannel({ embeds: [startupEmbed] });
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = (args.shift() || '').toLowerCase();

  if (["ping", "status", "estado"].includes(command)) {
    const botLatency = Date.now() - message.createdTimestamp;
    const wsLatency = Math.round(client.ws.ping);
    const uptime = Math.floor(process.uptime());
    const memory = Math.round(process.memoryUsage().rss / 1024 / 1024);

    const embed = new EmbedBuilder()
      .setTitle(command === "ping" ? '🏓 Pong!' : '📊 Estado del Bot')
      .setDescription(`Información de estado solicitada por ${message.author}`)
      .addFields(
        { name: '🏷 Bot Latency', value: `\`${botLatency} ms\``, inline: true },
        { name: '🌐 WS Latency', value: `\`${wsLatency} ms\``, inline: true },
        { name: '⏱ Uptime (s)', value: `\`${uptime}\``, inline: true },
        { name: '📁 Memoria (RSS)', value: `\`${memory} MB\``, inline: true },
      )
      .setTimestamp()
      .setColor(command === "ping" ? 0x5865F2 : 0xFEE75C)
      .setFooter({ text: `Comando: ${command}` });

    return message.reply({ embeds: [embed] });
  }
});

async function gracefulShutdown(signal) {
  console.log(`🔻 Recibido ${signal} — intentando enviar embed de apagado...`);
  try {
    const shutdownEmbed = makeShutdownEmbed(client, signal);
    await sendToConfiguredChannel({ embeds: [shutdownEmbed] });
  } finally {
    try { await client.destroy(); } catch {}
    setTimeout(() => process.exit(0), 1200);
  }
}

process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.once('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
  gracefulShutdown('uncaughtException: ' + (err?.message || 'unknown'));
});

client.login(DISCORD_TOKEN).catch(err => {
  console.error('❌ Error al iniciar sesión con el token proporcionado:', err);
  process.exit(1);
});
