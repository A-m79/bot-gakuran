const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent } = require('discord.js');

// Mémoire pour suivre le nombre de bans par utilisateur
const banTracker = new Map();
const BAN_LIMIT = 3;        // Max 3 bans
const TIME_FRAME = 10000;   // En 10 secondes (10 000 ms)

module.exports = {
    name: 'guildBanAdd',
    async execute(ban) {
        const guild = ban.guild;
        const now = Date.now();

        // Récupérer qui a effectué le ban via les Audit Logs
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
        const banLog = auditLogs?.entries.first();
        if (!banLog) return;

        const executor = banLog.executor;
        if (!executor || executor.id === guild.client.user.id || executor.id === guild.ownerId) return; // Ignorer le bot et le Fondateur

        // Suivi des actions de l'exécuteur
        if (!banTracker.has(executor.id)) {
            banTracker.set(executor.id, []);
        }

        const userBans = banTracker.get(executor.id);
        userBans.push(now);

        // Filtrer pour ne garder que les bans dans la fenêtre de 10 secondes
        const recentBans = userBans.filter(t => now - t < TIME_FRAME);
        banTracker.set(executor.id, recentBans);

        // 🚨 TENTATIVE DE NUKE DÉTECTÉE !
        if (recentBans.length >= BAN_LIMIT) {
            banTracker.delete(executor.id);

            // 1. Bannir l'administrateur / bot malveillant
            await guild.members.ban(executor.id, { reason: '🚨 ANTI-NUKE : Ban massif non autorisé détecté !' }).catch(() => null);

            // 2. Envoyer le log d'urgence avec le bouton de DÉBAN
            const logChannelId = process.env.SECURITY_LOGS_CHANNEL_ID?.trim();
            if (!logChannelId) return;

            const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
            if (!logChannel) return;

            const nukeEmbed = new EmbedBuilder()
                .setTitle('🚨 ALERTE ANTI-NUKE : ADMIN/BOT BANNIS !')
                .setColor('#FF0000')
                .setDescription(`⚠️ **Une tentative de Nuke/Mass-Ban a été neutralisée !**\n\nL'utilisateur **${executor.tag}** (\`${executor.id}\`) a effectué **${recentBans.length} bans** en moins de 10 secondes.\n\n👉 **Action automatique prise :** L'auteur a été banni du serveur.`)
                .setThumbnail(executor.displayAvatarURL())
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`antinuke_unban_${executor.id}`)
                    .setLabel('🔓 Débannir cet utilisateur / bot')
                    .setStyle(ButtonStyle.Success)
            );

            await logChannel.send({ 
                content: `🚨 <@${guild.ownerId}> **URGENT : Tentative de Nuke neutralisée !**`, 
                embeds: [nukeEmbed], 
                components: [row] 
            }).catch(() => null);
        }
    }
};