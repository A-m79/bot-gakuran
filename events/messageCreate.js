const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const LoggedMessage = require('../models/LoggedMessage');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // 💾 Sauvegarde automatique dans MongoDB (utilisée par messageDelete.js
        // pour retrouver le contenu d'un message supprimé non mis en cache)
        try {
            await LoggedMessage.create({
                messageId: message.id,
                channelId: message.channel.id,
                guildId: message.guild.id,
                authorId: message.author.id,
                authorTag: message.author.tag,
                content: message.content || '',
                attachments: message.attachments.map(a => a.url)
            });
        } catch (e) {
            // Ignore les erreurs de doublons d'index
        }

        const member = message.member;
        if (!member) return;

        const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages) || 
                        member.permissions.has(PermissionFlagsBits.Administrator) ||
                        member.roles.cache.some(r => r.name.toLowerCase() === 'bot info');

        if (isStaff) return;

        const logChannelId = process.env.SECURITY_LOGS_CHANNEL_ID?.trim();
        const logChannel = logChannelId ? await message.guild.channels.fetch(logChannelId).catch(() => null) : null;

        // ─── 1. ANTI-INVITE DISCORD ───
        // (Non géré par Lotus, on garde cette partie)
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
        // (Non géré par Lotus, on garde cette partie)
        if (message.content.includes('@everyone') || message.content.includes('@here')) {
            await message.delete().catch(() => null);
            const warnMsg = await message.channel.send(`❌ ${message.author}, tu n'as pas la permission d'utiliser les pings généraux !`);
            setTimeout(() => warnMsg.delete().catch(() => null), 4000);
            return;
        }

        // ─── 3. ANTI-SPAM & ANTI-FLOOD ───
        // Retiré : géré par Lotus (antiSpam.js) pour éviter le double sanction
        // sur le même serveur.
    }
};
