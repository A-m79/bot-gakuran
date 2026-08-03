const { EmbedBuilder, AuditLogEvent } = require('discord.js');

// Mémoire temporaire des Kicks : Map(moderatorId -> [timestamps])
const recentKicksMap = new Map();

const KICK_THRESHOLD = 3;        // Nombre max d'expulsions autorisées
const KICK_TIME_WINDOW = 10000;  // Dans une fenêtre de 10 secondes (10000 ms)

module.exports = {
    name: 'guildMemberRemove',
    async execute(member) {
        const guild = member.guild;
        const now = Date.now();

        // Salon de logs de sécurité
        const logChannelId = process.env.SECURITY_LOGS_CHANNEL_ID?.trim();
        const logChannel = logChannelId ? await guild.channels.fetch(logChannelId).catch(() => null) : null;

        try {
            // Petit délai d'attente pour s'assurer que Discord a inscrit l'action dans les Audit Logs
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Récupération du dernier Audit Log de type Kick
            const fetchedLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberKick,
            }).catch(() => null);

            if (!fetchedLogs) return;

            const kickLog = fetchedLogs.entries.first();
            if (!kickLog) return; // Si aucun log de kick, la personne est juste partie d'elle-même

            const { executor, target, createdAt } = kickLog;

            // Vérifier si le Kick concerne bien ce membre et est très récent (moins de 5s)
            if (target.id === member.id && (now - createdAt.getTime()) < 5000) {

                // 🚨 IMMUNITÉ : Le Fondateur/Owner du serveur et le Bot lui-même ne sont jamais sanctionnés
                if (executor.id === guild.ownerId || executor.id === guild.client.user.id) return;

                const executorId = executor.id;
                if (!recentKicksMap.has(executorId)) {
                    recentKicksMap.set(executorId, []);
                }

                const userKicks = recentKicksMap.get(executorId);
                userKicks.push(now);

                // Filtrer les Kicks dans la fenêtre de 10s
                const recentKicks = userKicks.filter(timestamp => now - timestamp < KICK_TIME_WINDOW);
                recentKicksMap.set(executorId, recentKicks);

                // ─── DÉTECTION DU MASS KICK ───
                if (recentKicks.length >= KICK_THRESHOLD) {
                    const executorMember = await guild.members.fetch(executorId).catch(() => null);

                    if (executorMember && executorMember.bannable) {
                        // Bannir immédiatement l'admin/modérateur malveillant
                        await executorMember.ban({ 
                            reason: `🚨 ANTI-NUKE : Mass Kick détecté (${recentKicks.length} expulsions en 10s)` 
                        }).catch(() => null);

                        // Alerte d'urgence dans le salon de logs
                        if (logChannel) {
                            const nukeKickEmbed = new EmbedBuilder()
                                .setTitle('🚨 ALERTE ANTI-NUKE : MASS KICK DÉTECTÉ !')
                                .setColor('#FF0000')
                                .setDescription(`**Un modérateur/admin a été BANNISSER pour tentative de Mass Kick !**`)
                                .addFields(
                                    { name: '👑 Coupable banni', value: `${executor.tag} (\`${executor.id}\`)`, inline: true },
                                    { name: '📊 Nombre de Kicks', value: `\`${recentKicks.length}\` expulsions en 10s`, inline: true },
                                    { name: '🎯 Dernier membre expulsé', value: `${member.user.tag} (\`${member.id}\`)` }
                                )
                                .setTimestamp();

                            await logChannel.send({
                                content: '🚨 @everyone **ALERTE NUKE : Un modérateur expulsait des membres en masse !**',
                                embeds: [nukeKickEmbed]
                            }).catch(() => null);
                        }

                        // Vider le compteur pour éviter de spammer le ban
                        recentKicksMap.delete(executorId);
                    }
                }
            }
        } catch (error) {
            console.error('[ANTI-MASS-KICK ERROR]', error);
        }
    }
};