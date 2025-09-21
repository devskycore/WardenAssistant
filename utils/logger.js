module.exports = {
  info: (msg) => console.log(JSON.stringify({ level: 'info', message: msg, timestamp: new Date().toISOString() })),
  warn: (msg) => console.warn(JSON.stringify({ level: 'warn', message: msg, timestamp: new Date().toISOString() })),
  error: (msg) => console.error(JSON.stringify({ level: 'error', message: msg, timestamp: new Date().toISOString() })),
};
