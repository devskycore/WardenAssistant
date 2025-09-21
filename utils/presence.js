const logger = require('./logger');

const phrases = [
  "⛏️ Minando diamantes",
  "🔥 Explorando el Nether",
  "🟢 Online desde que arrancó",
  "📦 Procesando paquetes de datos",
];

function rotatePresence(client, interval = 5 * 60 * 1000) {
  let i = 0;
  setInterval(() => {
    const phrase = phrases[i % phrases.length];
    client.user.setPresence({ activities: [{ name: phrase }], status: 'online' });
    logger.info(`Presencia actualizada: ${phrase}`);
    i++;
  }, interval);
}

module.exports = { rotatePresence };
