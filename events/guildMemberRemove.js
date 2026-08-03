const { EmbedBuilder, AuditLogEvent } = require('discord.js');

// Stockage temporaire des Kicks : Map(moderatorId -> [timestamps])
const recentKicksMap = new Map();

const KICK_THRESHOLD = 1;        // Seuil : 3 Kicks
const KICK_TIME_WINDOW = 10000;  // Dans une fenêtre de 10 secondes

module.exports = {
    name: 'guildMemberRemove',
    async execute(member) {
        const guild = member.guild;
        const now = Date.now();

        // Récupération du salon de logs de sécurité
        const logChannelId = process.env.SECURITY_LOGS_CHANNEL_ID?.trim();
        const logChannel = logChannelId ? await guild.channels.fetch(logChannelId).catch(() => null) : null;

        try {
            // Attendre 1.5 seconde que Discord inscrive l'action dans les Audit Logs
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Récupérer le dernier Audit Log de Kick
            const fetchedLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberKick,
            }).catch(() => null);

            if (!fetchedLogs) return;

            const kickLog = fetchedLogs.entries.first();
            if (!kickLog) return; // Départ naturel (le membre a quitté lui-même)

            const { executor, target, createdAt, reason } = kickLog;

            // Vérifier si l'expulsion concerne bien ce membre et est récente (moins de 7s)
            if (target.id === member.id && (now - createdAt.getTime()) < 7000) {

                // ─── 1. LOG DE KICK INDIVIDUEL ───
                if (logChannel) {
                    const kickLogEmbed = new EmbedBuilder()
                        .setTitle('👢 Membre Expulsé (Kick)')
                        .setColor('#FF9900')
                        .addFields(
                            { name: '👤 Membre/Bot expulsé', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
                            { name: '🛠️ Expulsé par', value: `${executor} (\`${executor.id}\`)`, inline: true },
                            { name: '📝 Raison', value: reason || 'Aucune raison fournie' }
                        )
                        .setTimestamp();

                    await logChannel.send({ embeds: [kickLogEmbed] }).catch(() => null);
                }

                // 🚨 IMMUNITÉ : Le Fondateur/Owner du serveur et le Bot lui-même sont immunisés
                if (executor.id === guild.ownerId || executor.id === guild.client.user.id) return;

                // ─── 2. DÉTECTION DU MASS KICK (ANTI-NUKE) ───
                const executorId = executor.id;
                if (!recentKicksMap.has(executorId)) {
                    recentKicksMap.set(executorId, []);
                }

                const userKicks = recentKicksMap.get(executorId);
                userKicks.push(now);

                // Filtrer les expulsions dans les 10 dernières secondes
                const recentKicks = userKicks.filter(timestamp => now - timestamp < KICK_TIME_WINDOW);
                recentKicksMap.set(executorId, recentKicks);

                if (recentKicks.length >= KICK_THRESHOLD) {
                    const executorMember = await guild.members.fetch(executorId).catch(() => null);

                    if (executorMember && executorMember.bannable) {
                        // Bannir le modérateur malveillant
                        await executorMember.ban({ 
                            reason: `🚨 ANTI-NUKE : Mass Kick (expulsion de ${recentKicks.length} membres en 10s)` 
                        }).catch(() => null);

                        if (logChannel) {
                            const nukeKickEmbed = new EmbedBuilder()
                                .setTitle('🚨 ALERTE ANTI-NUKE : MASS KICK DÉTECTÉ !')
                                .setColor('#FF0000')
                                .setDescription(`**Le modérateur ${executor} a été BANNISSER pour tentative de Mass Kick !**`)
                                .addFields(
                                    { name: '👑 Coupable banni', value: `${executor.tag} (\`${executor.id}\`)`, inline: true },
                                    { name: '📊 Expulsions', value: `\`${recentKicks.length}\` en 10 secondes`, inline: true }
                                )
                                .setTimestamp();

                            await logChannel.send({
                                content: '🚨 @everyone **ALERTE NUKE : Tentative d\'expulsion en masse arrêtée !**',
                                embeds: [nukeKickEmbed]
                            }).catch(() => null);
                        }

                        recentKicksMap.delete(executorId);
                    }
                }
            }
        } catch (error) {
            console.error('[GUILD_MEMBER_REMOVE ERROR]', error);
        }
    }
};