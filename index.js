const { Client, GatewayIntentBits, Events } = require('discord.js');
const dotenv = require('dotenv');

// Cargar las variables de entorno
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, c => {
  console.log(`✅ ¡Bot listo! Conectado como ${c.user.tag}`);
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  if (message.content.toLowerCase() === '!ping') {
    message.reply('¡Pong!');
  }
});

client.login(process.env.DISCORD_TOKEN);
