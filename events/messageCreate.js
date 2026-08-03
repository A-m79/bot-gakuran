const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Stockage temporaire des messages pour l'anti-spam/flood
const userMessageMap = new Map();

const SPAM_LIMIT = 5;          // Nombre max de messages
const SPAM_TIME_WINDOW = 3000; // Dans une fenêtre de 3 secondes (3000 ms)
const MUTE_DURATION = 5 * 60 * 1000; // Timeout de 5 minutes en cas de flood répétitif

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // Ignorer les bots et les MPs
        if (message.author.bot || !message.guild) return;

        const member = message.member;
        if (!member) return;

        // Le Staff / Admins / Rôle "bot info" passe outre ces restrictions
        const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages) || 
                        member.permissions.has(PermissionFlagsBits.Administrator) ||
                        member.roles.cache.some(r => r.name.toLowerCase() === 'bot info');

        if (isStaff) return;

        // Récupération du salon de logs de sécurité
        const logChannelId = process.env.SECURITY_LOGS_CHANNEL_ID?.trim();
        const logChannel = logChannelId ? await message.guild.channels.fetch(logChannelId).catch(() => null) : null;

        // ─── 1. ANTI-INVITE DISCORD & LIENS SUSPECTS ───
        const discordInviteRegex = /(discord\.(gg|io|me|li)|discord\.com\/invite)\/.+/i;
        if (discordInviteRegex.test(message.content)) {
            await message.delete().catch(() => null);

            const warnMsg = await message.channel.send(`⚠️ ${message.author}, les liens d'invitation Discord ne sont pas autorisés !`);
            setTimeout(() => warnMsg.delete().catch(() => null), 4000);

            if (logChannel) {
                const linkEmbed = new EmbedBuilder()
                    .setTitle('🛡️ Anti-Lien : Invitation Supprimée')
                    .setColor('#FF0000')
                    .addFields(
                        { name: '👤 Auteur', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                        { name: '📍 Salon', value: `${message.channel}`, inline: true },
                        { name: '💬 Contenu', value: `\`\`\`${message.content}\`\`\`` }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [linkEmbed] }).catch(() => null);
            }
            return;
        }

        // ─── 2. ANTI-PING EVERYONE / HERE ───
        if (message.content.includes('@everyone') || message.content.includes('@here')) {
            await message.delete().catch(() => null);
            const warnMsg = await message.channel.send(`❌ ${message.author}, tu n'as pas la permission d'utiliser les pings généraux !`);
            setTimeout(() => warnMsg.delete().catch(() => null), 4000);
            return;
        }

        // ─── 3. ANTI-SPAM & ANTI-FLOOD ───
        const now = Date.now();
        const userId = message.author.id;

        if (!userMessageMap.has(userId)) {
            userMessageMap.set(userId, []);
        }

        const userTimestamps = userMessageMap.get(userId);
        userTimestamps.push(now);

        // Garder seulement les messages envoyés dans la fenêtre définie
        const recentTimestamps = userTimestamps.filter(t => now - t < SPAM_TIME_WINDOW);
        userMessageMap.set(userId, recentTimestamps);

        if (recentTimestamps.length >= SPAM_LIMIT) {
            // Supprimer le dernier message
            await message.delete().catch(() => null);

            // Sanction : Timeout de 5 minutes
            await member.timeout(MUTE_DURATION, 'Spam / Flood automatique détecté par le bot').catch(() => null);

            // Message d'avertissement dans le salon
            const spamWarn = await message.channel.send(`⛔ ${message.author} a été réduit au silence pendant **5 minutes** pour spam/flood.`);
            setTimeout(() => spamWarn.delete().catch(() => null), 6000);

            // Reset du compteur pour cet utilisateur
            userMessageMap.delete(userId);

            if (logChannel) {
                const spamLogEmbed = new EmbedBuilder()
                    .setTitle('⚡ Anti-Spam : Exclusion Temporaire (Timeout)')
                    .setColor('#FF0000')
                    .setDescription(`L'utilisateur ${message.author} a été rendu muet pour spam intensif.`)
                    .addFields(
                        { name: '👤 Sanctionné', value: `<@${userId}> (\`${userId}\`)`, inline: true },
                        { name: '📍 Salon', value: `${message.channel}`, inline: true },
                        { name: '⏱️ Durée', value: '5 minutes', inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [spamLogEmbed] }).catch(() => null);
            }
        }
    }
};