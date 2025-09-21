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

module.exports = { formatUptime };
