const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionsBitField } = require('discord.js');
const logger = require('../utils/logger');
const { hasPermission, noPermissionEmbed } = require('../utils/permissions');
const { sendToConfiguredChannel } = require('../utils/queue');
const COLORS = require('../utils/colors');

const MAX_BULK = 100;        // máximo por bulkDelete
const MAX_SCAN = 5000;       // mensajes máximos a escanear por defecto (evita stalls)
const OLDER_DELETE_DELAY = 800; // ms entre deletes individuales (mensajes >14d)

function parseTimeUnit(str) {
  // ejemplos: 5m, 2h, 1d, 30s
  const m = /^(\d+)(s|m|h|d)$/.exec(str);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  switch (m[2]) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

function parseQuotedString(tokens, idx) {
  // consume tokens to build quoted string starting at tokens[idx]
  let t = tokens[idx];
  if (!t) return { value: null, consumed: 0 };
  if (!t.startsWith('"')) {
    return { value: t, consumed: 1 };
  }
  // token starts with quote
  let str = t.slice(1);
  let i = idx + 1;
  while (i < tokens.length) {
    const tk = tokens[i];
    const lastChar = tk.charAt(tk.length - 1);
    if (lastChar === '"') {
      str += ' ' + tk.slice(0, -1);
      return { value: str, consumed: i - idx + 1 };
    } else {
      str += ' ' + tk;
    }
    i++;
  }
  // no closing quote -> use rest
  return { value: str, consumed: tokens.length - idx };
}

function parseArgsToOptions(tokens) {
  // tokens: array of args after the command
  const options = {
    cantidad: null,
    usuario: null,           // user id
    contiene: null,
    adjuntos: false,
    bots: false,
    desde: null,
    hasta: null,
    reacciones: null,
    todos: false,
    ultimosMs: null,
    simulate: false,
    silent: false,
    maxScan: MAX_SCAN,
  };

  let i = 0;
  while (i < tokens.length) {
    const tk = tokens[i].toLowerCase();
    if (tk === 'cantidad') {
      const n = parseInt(tokens[i + 1], 10);
      if (!isNaN(n) && n > 0) { options.cantidad = n; i += 2; } else { i++; }
    } else if (tk === 'usuario') {
      const next = tokens[i + 1];
      if (!next) { i++; continue; }
      // mention like <@!id> or id
      const idMatch = next.match(/\d{17,19}/);
      if (idMatch) options.usuario = idMatch[0];
      i += 2;
    } else if (tk === 'contiene') {
      const parsed = parseQuotedString(tokens, i + 1);
      if (parsed.value) { options.contiene = parsed.value; i += 1 + parsed.consumed; } else { i++; }
    } else if (tk === 'adjuntos' || tk === 'attachments') {
      options.adjuntos = true; i++;
    } else if (tk === 'bots') {
      options.bots = true; i++;
    } else if (tk === 'entre-fechas' || tk === 'entre_fechas' || tk === 'entre') {
      // expect: desde <date> hasta <date>
      let j = i + 1;
      while (j < tokens.length) {
        const sub = tokens[j].toLowerCase();
        if (sub === 'desde' && tokens[j+1]) {
          const d = Date.parse(tokens[j+1]);
          if (!isNaN(d)) options.desde = new Date(d).getTime();
          j += 2;
        } else if (sub === 'hasta' && tokens[j+1]) {
          const d = Date.parse(tokens[j+1]);
          if (!isNaN(d)) options.hasta = new Date(d).getTime();
          j += 2;
        } else { break; }
      }
      i = j;
    } else if (tk === 'reacciones' || tk === 'reacciones:') {
      const r = tokens[i+1];
      if (r) { options.reacciones = r; i += 2; } else i++;
    } else if (tk === 'todos') {
      options.todos = true; i++;
    } else if (tk === 'ultimos' || tk === 'ultimos:' || tk === 'ultimos_ms' || tk === 'ultimos_m') {
      const val = tokens[i+1];
      const ms = parseTimeUnit(val || '');
      if (ms) { options.ultimosMs = ms; i += 2; } else { i++; }
    } else if (tk === 'simulate' || tk === 'simular') {
      options.simulate = true; i++;
    } else if (tk === 'silent' || tk === 'silencioso') {
      options.silent = true; i++;
    } else if (tk === 'maxscan') {
      const m = parseInt(tokens[i+1], 10);
      if (!isNaN(m) && m > 0) options.maxScan = Math.min(m, 20000);
      i += 2;
    } else {
      // unknown token -> skip
      i++;
    }
  }
  return options;
}

async function fetchMessagesToScan(channel, maxToScan, beforeId = null) {
  // fetch up to maxToScan messages in batches of 100
  let fetched = [];
  let lastId = beforeId;
  let remaining = maxToScan;
  while (remaining > 0) {
    const limit = Math.min(100, remaining);
    const opts = { limit };
    if (lastId) opts.before = lastId;
    /* eslint-disable no-await-in-loop */
    const batch = await channel.messages.fetch(opts);
    /* eslint-enable no-await-in-loop */
    if (!batch.size) break;
    const arr = Array.from(batch.values());
    fetched.push(...arr);
    remaining -= arr.length;
    lastId = arr[arr.length - 1].id;
    if (arr.length < limit) break; // no more
  }
  return fetched;
}

function messageMatches(message, options) {
  // filters:
  if (options.usuario && message.author.id !== options.usuario) return false;
  if (options.contiene) {
    const txt = (message.content || '').toLowerCase();
    if (!txt.includes(options.contiene.toLowerCase())) return false;
  }
  if (options.adjuntos) {
    if (!message.attachments || message.attachments.size === 0) return false;
  }
  if (options.bots) {
    if (!message.author.bot) return false;
  }
  if (options.desde && message.createdTimestamp < options.desde) return false;
  if (options.hasta && message.createdTimestamp > options.hasta) return false;
  if (options.ultimosMs) {
    const cutoff = Date.now() - options.ultimosMs;
    if (message.createdTimestamp < cutoff) return false;
  }
  if (options.reacciones) {
    // match by emoji name or id or unicode
    const r = message.reactions.cache.find(rc => {
      if (!rc) return false;
      const e = rc.emoji;
      if (!e) return false;
      if (options.reacciones === e.name) return true;
      if (options.reacciones === e.id) return true;
      if (options.reacciones === e.toString()) return true;
      return false;
    });
    if (!r) return false;
  }
  return true;
}

function humanDate(ts) {
  return new Date(ts).toLocaleString();
}

module.exports = {
  name: 'purge',
  aliases: ['eliminar'],
  description: 'Purgar mensajes avanzadamente con múltiples filtros y confirmación.',
  usage: '/purge <subcomando> [opciones]',
  async execute(message, args, client) {
    // permisos combinados: tu verificación global + permission de servidor
    if (!hasPermission(message)) {
      return message.reply({ embeds: [noPermissionEmbed(message.author)] });
    }

    // servidor restringido?
    const GUILD_ID = process.env.GUILD_ID;
    if (!message.guild || (GUILD_ID && message.guild.id !== GUILD_ID)) {
      return message.reply({ content: '⛔ Este comando solo está disponible en el servidor configurado.' });
    }

    // verificar permisos de moderador en el servidor
    const memberPerms = message.member.permissions;
    if (!memberPerms.has(PermissionsBitField.Flags.ManageMessages) && !memberPerms.has(PermissionsBitField.Flags.Administrator)) {
      const embed = new EmbedBuilder()
        .setTitle('⛔ Permisos insuficientes')
        .setDescription('Necesitas `Manage Messages` o `Administrator` para usar este comando.')
        .setColor(COLORS.error)
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    // parse args en opciones
    const tokens = args; // array de strings
    const options = parseArgsToOptions(tokens);

    // si no se especifica nada -> default purge cantidad 50
    if (!options.cantidad && !options.usuario && !options.contiene && !options.adjuntos && !options.bots && !options.desde && !options.hasta && !options.reacciones && !options.todos && !options.ultimosMs) {
      options.cantidad = 50;
    }

    // Escanear mensajes para encontrar coincidencias (simulación previa)
    const channel = message.channel;
    await message.channel.sendTyping();

    // Determine how many messages to scan:
    const scanLimit = Math.min(options.maxScan || MAX_SCAN, 20000);

    // fetch messages to scan in batches
    let scanned = await fetchMessagesToScan(channel, scanLimit, message.id); // start before the command message
    // exclude command message and bot's own confirmation placeholders (we started before message.id)
    // filter scanned messages according to options
    const matched = [];
    for (const m of scanned) {
      // do not delete the invoking command itself (safety)
      if (m.id === message.id) continue;
      if (messageMatches(m, options)) matched.push(m);
      // if cantidad specified, stop early when we have enough
      if (options.cantidad && matched.length >= options.cantidad) break;
      // safety stop if we collected too many (prevent memory bomb)
      if (matched.length >= scanLimit) break;
    }

    // If 'todos'=true, we may need a bigger scan (warn user)
    if (options.todos && scanned.length < scanLimit) {
      // Attempt to try to scan more (up to a higher cap) to find more messages when 'todos' requested
      const extraScan = Math.min(10000, Math.max(0, scanLimit * 4));
      if (extraScan > scanLimit) {
        const more = await fetchMessagesToScan(channel, extraScan, scanned.length ? scanned[scanned.length - 1].id : message.id);
        // append and re-evaluate (naive - careful with memory)
        for (const m of more) {
          if (m.id === message.id) continue;
          if (messageMatches(m, options)) matched.push(m);
          if (matched.length >= extraScan) break;
        }
      }
    }

    // If we used ultimosMs filter, we should ensure between dates logic also handled
    // Prepare summary embed (simulation)
    const previewCount = Math.min(matched.length, 5);
    const previewSamples = matched.slice(0, previewCount).map(m => `• ${m.author.tag} | ${humanDate(m.createdTimestamp)}\n  ${m.content ? (m.content.length > 120 ? m.content.slice(0, 117) + '...' : m.content) : '[no text]'}${m.attachments.size ? `\n  Attachments: ${m.attachments.size}` : ''}`).join('\n\n');

    const filtersUsed = [];
    if (options.cantidad) filtersUsed.push(`cantidad: ${options.cantidad}`);
    if (options.usuario) filtersUsed.push(`usuario: <@${options.usuario}>`);
    if (options.contiene) filtersUsed.push(`contiene: "${options.contiene}"`);
    if (options.adjuntos) filtersUsed.push('adjuntos');
    if (options.bots) filtersUsed.push('bots');
    if (options.desde) filtersUsed.push(`desde: ${humanDate(options.desde)}`);
    if (options.hasta) filtersUsed.push(`hasta: ${humanDate(options.hasta)}`);
    if (options.ultimosMs) filtersUsed.push(`ultimos: ${Math.round(options.ultimosMs/1000)}s`);
    if (options.reacciones) filtersUsed.push(`reacciones: ${options.reacciones}`);
    if (options.todos) filtersUsed.push('todos');

    const simEmbed = new EmbedBuilder()
      .setTitle('🧹 Purge - Simulación / Confirmación')
      .setDescription(`Se encontraron **${matched.length}** mensajes que coinciden con los filtros en la porción escaneada.\n\`\`\`\nFiltros: ${filtersUsed.join(' • ') || 'ninguno'}\n\`\`\``)
      .setColor(COLORS.status)
      .setTimestamp();

    if (previewSamples) simEmbed.addFields({ name: `Ejemplos (${previewCount})`, value: previewSamples });

    // If simulate-only, show results and return
    if (options.simulate) {
      // send simulation embed and return
      await message.reply({ embeds: [simEmbed] });
      return;
    }

    // If nothing to delete -> reply and exit
    if (!matched.length) {
      const noneEmbed = new EmbedBuilder()
        .setTitle('ℹ️ Purge - Sin coincidencias')
        .setDescription('No se encontraron mensajes que coincidan con los filtros en el rango analizado.')
        .setColor(COLORS.success)
        .setTimestamp();
      return message.reply({ embeds: [noneEmbed] });
    }

    // Confirmation buttons (only for destructive actions (>0) or when `todos` present)
    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('purge_confirm').setLabel('✅ Confirmar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('purge_cancel').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary),
    );

    const warnEmbed = new EmbedBuilder()
      .setTitle('⚠️ Confirmación requerida')
      .setDescription(`${message.author}, ¿confirmas eliminar **${matched.length}** mensajes en ${channel}?`)
      .addFields(
        { name: 'Filtros', value: filtersUsed.join(' • ') || 'ninguno', inline: false },
        { name: 'Nota', value: 'Se excluirá el mensaje de comando y los mensajes del bot de la operación por seguridad.', inline: false },
      )
      .setColor(COLORS.error)
      .setTimestamp();

    const confirmMsg = await message.reply({ embeds: [warnEmbed], components: [confirmRow] });

    // await button interaction
    try {
      const interaction = await confirmMsg.awaitMessageComponent({
        componentType: ComponentType.Button,
        time: 45_000,
        filter: i => i.user.id === message.author.id,
      });

      if (interaction.customId === 'purge_cancel') {
        await interaction.update({ content: '❌ Purge cancelado.', embeds: [], components: [] });
        return;
      }

      // interaction is confirm
      await interaction.update({ content: '⏳ Iniciando purga... preparando eliminación', embeds: [], components: [] });

    } catch (err) {
      // timed out or error
      try { await confirmMsg.edit({ content: '⏱ Tiempo de confirmación agotado. Purge cancelado.', embeds: [], components: [] }); } catch (e) {}
      return;
    }

    // START DELETION - send initial progress embed
    const progressEmbed = new EmbedBuilder()
      .setTitle('🧹 Purga en progreso')
      .setDescription(`Iniciada por ${message.author} — procesando ${matched.length} mensajes...`)
      .addFields(
        { name: 'Canal', value: `${channel}`, inline: true },
        { name: 'Iniciado', value: humanDate(Date.now()), inline: true },
      )
      .setColor(COLORS.status)
      .setTimestamp();

    const progressMsg = await channel.send({ embeds: [progressEmbed] });

    // Exclude the bot progress message and the original command message from deletion set (safety)
    const toDelete = matched.filter(m => m.id !== message.id && m.id !== progressMsg.id);

    // Partition by age: youngerThan14Days (eligible for bulk) and older
    const THIRTY_DAYS_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
    const now = Date.now();
    const younger = [];
    const older = [];
    for (const m of toDelete) {
      if ((now - m.createdTimestamp) > THIRTY_DAYS_MS) older.push(m);
      else younger.push(m);
    }

    let deletedCount = 0;
    let failedCount = 0;
    const startTs = Date.now();

    // Delete younger messages in batches using bulkDelete (max 100 per call)
    try {
      for (let i = 0; i < younger.length; i += MAX_BULK) {
        const batch = younger.slice(i, i + MAX_BULK);
        const ids = batch.map(x => x.id);
        try {
          // bulkDelete filterOld = true ensures it will skip older than 14d (safety)
          const res = await channel.bulkDelete(ids, true);
          const deleted = res.size || 0;
          deletedCount += deleted;
        } catch (err) {
          // fallback: delete individually (rare)
          logger.warn(`bulkDelete error: ${err.message} - intentando delete individual por batch`);
          for (const msg of batch) {
            try { await msg.delete(); deletedCount++; }
            catch (e) { failedCount++; logger.error(`delete individual failed: ${e.message}`); }
            // small delay
            /* eslint-disable no-await-in-loop */
            await new Promise(r => setTimeout(r, 200));
            /* eslint-enable no-await-in-loop */
          }
        }
        // optional: update progress embed every batch
        try {
          await progressMsg.edit({ embeds: [ new EmbedBuilder()
            .setTitle('🧹 Purga en progreso')
            .setDescription(`Eliminando mensajes... (${deletedCount} eliminados hasta ahora)`)
            .addFields(
              { name: 'Canal', value: `${channel}`, inline: true },
              { name: 'Progreso', value: `${Math.min(deletedCount + failedCount, toDelete.length)} / ${toDelete.length}`, inline: true },
            )
            .setColor(COLORS.status)
            .setTimestamp()
          ]});
        } catch(e){ /* ignore edit errors */ }
      }

      // Now delete older messages individually (if any)
      if (older.length) {
        // Warn if many old messages: ask again if > 200 to avoid huge runs
        if (older.length > 200) {
          // ask for a second confirmation
          const againEmbed = new EmbedBuilder()
            .setTitle('⚠️ Mensajes antiguos detectados')
            .setDescription(`Se han detectado **${older.length}** mensajes con más de 14 días. El borrado individual es lento y puede consumir tiempo.\n¿Deseas proceder con la eliminación individual (esto puede tardar)?`)
            .setColor(COLORS.error)
            .setTimestamp();
          const againRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('purge_old_confirm').setLabel('✅ Proceder').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('purge_old_cancel').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary),
          );
          const againMsg = await channel.send({ embeds: [againEmbed], components: [againRow] });
          try {
            const inter = await againMsg.awaitMessageComponent({ componentType: ComponentType.Button, time: 30_000, filter: i => i.user.id === message.author.id });
            if (inter.customId === 'purge_old_cancel') {
              await inter.update({ content: '❌ Cancelado eliminación de mensajes antiguos.', embeds: [], components: [] });
              // finalize (do not delete older)
              // continue to finalization
            } else {
              await inter.update({ content: '⏳ Iniciando eliminación individual de mensajes antiguos...', embeds: [], components: [] });
              // proceed to delete older
              for (const m of older) {
                try { await m.delete(); deletedCount++; }
                catch (e) { failedCount++; logger.error(`Failed deleting old message ${m.id}: ${e.message}`); }
                /* eslint-disable no-await-in-loop */
                await new Promise(r => setTimeout(r, OLDER_DELETE_DELAY));
                /* eslint-enable no-await-in-loop */
              }
            }
          } catch (err) {
            // timed out => skip older deletions
            try { await againMsg.edit({ content: '⏱ Tiempo agotado; cancelando eliminación de mensajes antiguos.', embeds: [], components: [] }); } catch(e){}
          }
        } else {
          // safe to proceed with older deletion without extra ask (small number)
          for (const m of older) {
            try { await m.delete(); deletedCount++; }
            catch (e) { failedCount++; logger.error(`Failed deleting old message ${m.id}: ${e.message}`); }
            /* eslint-disable no-await-in-loop */
            await new Promise(r => setTimeout(r, OLDER_DELETE_DELAY));
            /* eslint-enable no-await-in-loop */
          }
        }
      }

    } catch (err) {
      logger.error(`Error durante purga: ${err.message}`);
    }

    const durationMs = Date.now() - startTs;
    // final embed
    const finalEmbed = new EmbedBuilder()
      .setTitle('✅ Purga finalizada')
      .setDescription(`Operación completada por ${message.author}`)
      .addFields(
        { name: 'Canal', value: `${channel}`, inline: true },
        { name: 'Mensajes eliminados', value: `${deletedCount}`, inline: true },
        { name: 'Fallidos', value: `${failedCount}`, inline: true },
        { name: 'Filtros', value: filtersUsed.join(' • ') || 'ninguno', inline: false },
        { name: 'Duración', value: `${Math.round(durationMs/1000)}s`, inline: true },
      )
      .setColor(COLORS.success)
      .setTimestamp();

    try { await progressMsg.edit({ embeds: [finalEmbed], components: [] }); } catch (e) {}

    // send moderation log to configured log channel (via utils queue)
    try {
      const modEmbed = new EmbedBuilder()
        .setTitle('🧾 Registro: Purga de mensajes')
        .setDescription(`Purge ejecutada por ${message.author.tag} (${message.author.id})`)
        .addFields(
          { name: 'Canal', value: `${channel}`, inline: true },
          { name: 'Eliminados', value: `${deletedCount}`, inline: true },
          { name: 'Fallidos', value: `${failedCount}`, inline: true },
          { name: 'Filtros', value: filtersUsed.join(' • ') || 'ninguno', inline: false },
        )
        .setColor(COLORS.error)
        .setTimestamp();
      await sendToConfiguredChannel(client, { embeds: [modEmbed] });
    } catch (err) {
      logger.warn(`No se pudo enviar log de purga: ${err.message}`);
    }

    // if silent -> DM the executor with a short summary and delete bot messages in channel if wanted (we leave logs)
    if (options.silent) {
      try {
        await message.author.send({ embeds: [finalEmbed] });
        // optionally remove the public final message to be silent (commented out by default)
        // await progressMsg.delete().catch(()=>{});
      } catch (e) {
        logger.warn(`No se pudo enviar DM al ejecutor: ${e.message}`);
      }
    }

    return;
  },
};
