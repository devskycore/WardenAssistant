const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const dotenv = require('dotenv');

// Cargar variables de entorno desde .env
dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const GUILD_ID = process.env.GUILD_ID;
const PREFIX = (process.env.BOT_PREFIX || '$').trim();

// --- Validación de token ---
if (!DISCORD_TOKEN) {
  console.error('⛔ DISCORD_TOKEN no está configurado en .env.');
  process.exit(1);
}

// --- Logger estructurado ---
const logger = {
  info: (msg) => console.log(JSON.stringify({ level: 'info', message: msg, timestamp: new Date().toISOString() })),
  warn: (msg) => console.warn(JSON.stringify({ level: 'warn', message: msg, timestamp: new Date().toISOString() })),
  error: (msg) => console.error(JSON.stringify({ level: 'error', message: msg, timestamp: new Date().toISOString() })),
};

// --- Colores reutilizables ---
const COLORS = {
  success: 0x57F287,
  error: 0xED4245,
  status: 0x5865F2,
};

// --- Cliente ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// --- Helper: formato uptime ---
function formatUptime(seconds) {
  const units = [
    { label: 'año', secs: 31536000 },
    { label: 'mes', secs: 2592000 },
    { label: 'semana', secs: 604800 },
    { label: 'día', secs: 86400 },
    { label: 'hora', secs: 3600 },
    { label: 'minuto', secs: 60 },
    { label: 'segundo', secs: 1 },
  ];

  let remaining = seconds;
  const parts = [];

  for (const u of units) {
    const value = Math.floor(remaining / u.secs);
    if (value > 0) {
      parts.push(`${value} ${u.label}${value > 1 ? 's' : ''}`);
      remaining %= u.secs;
    }
  }

  return parts.length > 0 ? parts.join(', ') : '0 segundos';
}

// --- Embeds de inicio/apagado ---
function makeStartupEmbed(client) {
  return new EmbedBuilder()
    .setTitle('⚡ Bot encendido')
    .setDescription(`¡Estoy **en línea** como **${client.user?.tag}** ✨`)
    .addFields(
      { name: '🔰 Estado', value: '🟢 Conectado', inline: true },
      { name: '🧭 Prefix', value: `\`${PREFIX}\``, inline: true },
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

async function sendToConfiguredChannel(payload) {
  if (!CHANNEL_ID) return logger.warn('CHANNEL_ID no configurado.');
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (channel?.isTextBased()) {
      await channel.send(payload);
      logger.info('Embed enviado a canal configurado.');
    }
  } catch (err) {
    logger.error(`Error enviando mensaje a canal configurado: ${err.message}`);
  }
}

// --- Evento: listo ---
client.once(Events.ClientReady, async (c) => {
  logger.info(`Bot listo como ${c.user.tag}`);
  try {
    // Presencia creativa y técnica con temática Minecraft
    await c.user.setPresence({
      activities: [{ name: 'minando paquetes en el Nether ⛏️🔥' }],
      status: 'online',
    });
  } catch (e) {
    logger.warn(`No se pudo establecer presencia: ${e.message}`);
  }
  await sendToConfiguredChannel({ embeds: [makeStartupEmbed(client)] });
});

// --- Comando de estado ---
function makeStatusEmbed(message, client) {
  const botLatency = Date.now() - message.createdTimestamp;
  const wsLatency = Math.round(client.ws.ping);

  return new EmbedBuilder()
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
}

// --- Comando de ayuda ---
function makeHelpEmbed(author) {
  return new EmbedBuilder()
    .setTitle('📖 Lista de comandos')
    .setDescription(`Solicitado por ${author}`)
    .addFields(
      { name: 'Estado del bot', value: '`status`', inline: true },
      { name: 'Alias', value: '`ping`, `estado`', inline: true },
      { name: 'Ayuda', value: '`help`', inline: true },
    )
    .setColor(COLORS.success)
    .setTimestamp();
}

// --- Permisos ---
function hasPermission(message) {
  const isAdmin = message.member?.roles.cache.some(r => r.name.toLowerCase() === 'admin');
  const isDev = message.author.id === '1407964057901731850';
  return isAdmin && isDev;
}

// --- Procesar comandos ---
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== GUILD_ID) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = (args.shift() || '').toLowerCase();

  if (!hasPermission(message)) {
    return message.reply('⛔ No tienes permisos para usar este bot.');
  }

  if (["status", "ping", "estado"].includes(command)) {
    return message.reply({ embeds: [makeStatusEmbed(message, client)] });
  }

  if (command === 'help') {
    return message.reply({ embeds: [makeHelpEmbed(message.author)] });
  }
});

// --- Shutdown ---
async function gracefulShutdown(signal) {
  logger.warn(`Recibido ${signal}, apagando bot...`);
  try {
    await sendToConfiguredChannel({ embeds: [makeShutdownEmbed(client, signal)] });
  } catch (err) {
    logger.error(`Error enviando embed de apagado: ${err.message}`);
  } finally {
    try { await client.destroy(); } catch {}
    setTimeout(() => process.exit(0), 1200);
  }
}

process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.once('uncaughtException', (err) => {
  logger.error(`uncaughtException: ${err.message}`);
  gracefulShutdown('uncaughtException');
});
process.once('unhandledRejection', (reason) => {
  logger.error(`unhandledRejection: ${reason}`);
  gracefulShutdown('unhandledRejection');
});

// --- Login ---
client.login(DISCORD_TOKEN).catch(err => {
  logger.error(`Error al iniciar sesión: ${err.message}`);
  process.exit(1);
});
