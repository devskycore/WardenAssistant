const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const dotenv = require('dotenv');

// Cargar variables de entorno desde .env
dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID; // ID del canal donde enviaremos los embeds de start/stop
const PREFIX = (process.env.BOT_PREFIX || '$').trim();

if (!DISCORD_TOKEN) {
  console.error('⛔ DISCORD_TOKEN no está configurado en .env. Salida.');
  process.exit(1);
}

// Crear cliente con los intents necesarios para recibir mensajes y contenido de mensaje
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Contador simple de mensajes procesados desde el arranque
let messageCounter = 0;

// --- Helper: crear un embed bonito para START ---
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
    .setColor(0x57F287) // verde agradable
    .setFooter({ text: 'Mensaje automático — inicio', iconURL: client.user?.displayAvatarURL() });
}

// --- Helper: crear embed para SHUTDOWN ---
function makeShutdownEmbed(client, reason) {
  return new EmbedBuilder()
    .setTitle('🔻 Bot apagándose')
    .setDescription(`El bot **${client.user?.tag || 'desconocido'}** se está apagando. ${reason ? `Reason: ${reason}` : ''}`)
    .addFields(
      { name: '🔴 Estado', value: 'Desconectando', inline: true },
      { name: '⏱ Uptime (s)', value: `${Math.floor(process.uptime())}`, inline: true },
      { name: '📨 Mensajes (desde inicio)', value: `${messageCounter}`, inline: true },
    )
    .setTimestamp()
    .setColor(0xED4245)
    .setFooter({ text: 'Mensaje automático — apagado', iconURL: client.user?.displayAvatarURL() });
}

// --- Envía un embed a CHANNEL_ID si está configurado ---
async function sendToConfiguredChannel(payload) {
  if (!CHANNEL_ID) {
    console.warn('⚠️ CHANNEL_ID no configurado. No se enviará el mensaje de estado.');
    return;
  }

  try {
    // Fetch asegura que obtenemos el canal aunque no esté en cache
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.warn(`⚠️ Canal con ID ${CHANNEL_ID} no encontrado.`);
      return;
    }

    // isTextBased() cubre TextChannel, ThreadChannel, DMChannel, etc. Evitamos canales de voz.
    if (channel.isTextBased && channel.isTextBased()) {
      await channel.send(payload);
      console.log('✅ Embed enviado a canal configurado.');
    } else {
      console.warn('⚠️ El canal encontrado no es de texto o no soporta envío de mensajes.');
    }
  } catch (err) {
    console.error('❌ Error enviando mensaje al canal configurado:', err);
  }
}

// --- Evento: listo (startup) ---
client.once(Events.ClientReady, async (c) => {
  console.log(`✅ ¡Bot listo! Conectado como ${c.user.tag}`);

  // Asignar actividad opcional
  try {
    await client.user.setPresence({ activities: [{ name: `${PREFIX}ping | ${client.guilds.cache.size} servers` }], status: 'online' });
  } catch (e) {
    console.warn('⚠️ No se pudo establecer presence:', e.message);
  }

  // Crear embed de inicio y enviarlo
  const startupEmbed = makeStartupEmbed(client);
  await sendToConfiguredChannel({ embeds: [startupEmbed] });
});

// --- Comandos por prefijo ---
client.on(Events.MessageCreate, async (message) => {
  // Ignorar bots
  if (message.author.bot) return;

  // Contar mensajes procesados
  messageCounter += 1;

  // Evitar procesar DMs (opcional): si quieres permitir DMs, elimina esta línea
  if (!message.guild) return;

  // Comprobar prefijo
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = (args.shift() || '').toLowerCase();

  // Alias para typo "estado" + comando normal "status"
  if (command === 'ping') {
    // Bot latency: tiempo entre la creación del mensaje y ahora
    const botLatency = Date.now() - message.createdTimestamp;
    const wsLatency = Math.round(client.ws.ping);
    const shardInfo = client.shard?.ids ? client.shard.ids.join(', ') : 'N/A';

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setDescription(`Respuesta rápida — \`${message.author.tag}\``)
      .addFields(
        { name: '🏷 Bot Latency', value: `\`${botLatency} ms\``, inline: true },
        { name: '🌐 WS Latency', value: `\`${wsLatency} ms\``, inline: true },
        { name: '📨 Mensajes (desde inicio)', value: `\`${messageCounter}\``, inline: true },
        { name: '🛰 Shard', value: `\`${shardInfo}\``, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: 'Comando: ping' });

    return message.reply({ embeds: [embed] });
  }

  if (command === 'status' || command === 'estado') {
    const botLatency = Date.now() - message.createdTimestamp;
    const wsLatency = Math.round(client.ws.ping);
    const shardInfo = client.shard?.ids ? client.shard.ids.join(', ') : 'N/A';

    const embed = new EmbedBuilder()
      .setTitle('📊 Estado del Bot')
      .setDescription(`Información detallada del estado — solicitada por ${message.author}`)
      .addFields(
        { name: '🏷 Bot Latency', value: `\`${botLatency} ms\``, inline: true },
        { name: '🌐 WS Latency', value: `\`${wsLatency} ms\``, inline: true },
        { name: '⏱ Uptime (s)', value: `\`${Math.floor(process.uptime())}\``, inline: true },
        { name: '📨 Mensajes (desde inicio)', value: `\`${messageCounter}\``, inline: true },
        { name: '🛰 Shard', value: `\`${shardInfo}\``, inline: true },
        { name: '📁 Memoria (RSS)', value: `\`${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB\``, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: `Comando: ${command}` });

    return message.reply({ embeds: [embed] });
  }

  // Aquí puedes añadir más comandos usando el mismo patrón
});

// --- Graceful shutdown: enviar embed antes de salir ---
async function gracefulShutdown(signal) {
  console.log(`🔻 Recibido ${signal} — intentando enviar embed de apagado...`);
  try {
    const shutdownEmbed = makeShutdownEmbed(client, signal);
    await sendToConfiguredChannel({ embeds: [shutdownEmbed] });
  } catch (err) {
    console.error('❌ Error durante el envío del embed de apagado:', err);
  } finally {
    // Destruir cliente para cerrar conexiones websocket y luego salir
    try {
      await client.destroy();
    } catch (e) {
      // ignorar
    }
    // Forzamos salida después de un pequeño delay para dar tiempo al envío
    setTimeout(() => process.exit(0), 1200);
  }
}

// Escuchar señales comunes para shutdown
process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Capturar excepciones no manejadas para intentar enviar el embed también
process.once('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
  gracefulShutdown('uncaughtException: ' + (err && err.message ? err.message : 'unknown'));
});

// Login
client.login(DISCORD_TOKEN).catch(err => {
  console.error('❌ Error al iniciar sesión con el token proporcionado:', err);
  process.exit(1);
});
