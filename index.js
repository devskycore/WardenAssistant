const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const logger = require('./utils/logger');

// Cargar variables de entorno
dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  logger.error('⛔ DISCORD_TOKEN no está configurado en .env.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Colección de comandos
client.commands = new Collection();

// --- Cargar comandos ---
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath)) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.name, command);
  if (command.aliases) {
    command.aliases.forEach(alias => client.commands.set(alias, command));
  }
}

// --- Cargar eventos ---
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath)) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Manejo global de errores
process.on('uncaughtException', (err) => {
  logger.error(`uncaughtException: ${err.message}`);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`unhandledRejection: ${reason}`);
});

client.login(DISCORD_TOKEN).catch(err => {
  logger.error(`Error al iniciar sesión: ${err.message}`);
  process.exit(1);
});
