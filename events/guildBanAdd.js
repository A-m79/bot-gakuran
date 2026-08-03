const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent } = require('discord.js');

// Stockage : executorId -> [{ timestamp, targetId, targetTag }]
const banTracker = new Map();
const BAN_LIMIT = 1;        // Seuil : 3 bans (remets à 1 si tu veux tester tout seul)
const TIME_FRAME = 10000;   // Fenêtre de 10 secondes (10 000 ms)

module.exports = {
    name: 'guildBanAdd',
    async execute(ban) {
        const guild = ban.guild;
        const now = Date.now();

        // Récupérer le salon de logs de sécurité
        const logChannelId = process.env.SECURITY_LOGS_CHANNEL_ID?.trim();
        const logChannel = logChannelId ? await guild.channels.fetch(logChannelId).catch(() => null) : null;

        try {
            // Attendre 1.5s pour s'assurer que Discord a inscrit l'action dans les Audit Logs
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Récupérer qui a effectué le ban via les Audit Logs
            const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
            const banLog = auditLogs?.entries.first();
            if (!banLog) return;

            const { executor, target, reason } = banLog;

            // Vérifier que le log correspond bien au membre banni
            if (target.id === ban.user.id) {

                // ─── 1. LOG DE BAN INDIVIDUEL ───
                if (logChannel) {
                    const banActionRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`unban_${target.id}`)
                            .setLabel('🔓 Débannir')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`reinvite_${target.id}`)
                            .setLabel('📩 Réinviter par MP')
                            .setStyle(ButtonStyle.Primary)
                    );

                    const banLogEmbed = new EmbedBuilder()
                        .setTitle('🔨 Membre Banni')
                        .setColor('#FF0000')
                        .addFields(
                            { name: '👤 Utilisateur banni', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
                            { name: '🛠️ Banni par', value: `${executor} (\`${executor.id}\`)`, inline: true },
                            { name: '📝 Raison', value: reason || 'Aucune raison fournie' }
                        )
                        .setTimestamp();

                    await logChannel.send({ embeds: [banLogEmbed], components: [banActionRow] }).catch(() => null);
                }

                // Ignorer le Bot lui-même et le Fondateur pour l'Anti-Nuke
                if (!executor || executor.id === guild.client.user.id || executor.id === guild.ownerId) return;

                // ─── 2. SUIVI ANTI-NUKE (MASS BAN INTELLIGENT) ───
                const executorId = executor.id;
                if (!banTracker.has(executorId)) {
                    banTracker.set(executorId, []);
                }

                const userBans = banTracker.get(executorId);
                userBans.push({ timestamp: now, targetId: ban.user.id, targetTag: ban.user.tag });

                // Ne garder que les bans dans la fenêtre de 10 secondes
                const recentBans = userBans.filter(b => now - b.timestamp < TIME_FRAME);
                banTracker.set(executorId, recentBans);

                // 🚨 TENTATIVE DE NUKE DÉTECTÉE !
                if (recentBans.length >= BAN_LIMIT) {
                    banTracker.delete(executorId);

                    // Bannir l'administrateur / modérateur malveillant
                    await guild.members.ban(executorId, { reason: `🚨 ANTI-NUKE : Mass Ban (${recentBans.length} bans en 10s)` }).catch(() => null);

                    if (logChannel) {
                        // Bouton principal pour débannir le modérateur sanctionné
                        const nukeRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`unban_${executor.id}`)
                                .setLabel('🔓 Débannir le Modérateur')
                                .setStyle(ButtonStyle.Danger)
                        );

                        // Générer la liste des membres affectés + boutons de rétablissement
                        const affectedMembers = [];
                        recentBans.forEach((banItem) => {
                            affectedMembers.push(`• <@${banItem.targetId}> (\`${banItem.targetTag}\`)`);

                            // Limite Discord : maximum 5 boutons par ligne
                            if (nukeRow.components.length < 5) {
                                const shortName = banItem.targetTag.split('#')[0];
                                nukeRow.addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`reinvite_${banItem.targetId}`)
                                        .setLabel(`🔄 Rétablir ${shortName}`)
                                        .setStyle(ButtonStyle.Success)
                                );
                            }
                        });

                        const nukeEmbed = new EmbedBuilder()
                            .setTitle('🚨 ALERTE ANTI-NUKE : MASS BAN DÉTECTÉ')
                            .setColor('#FF0000')
                            .setDescription(`**Le modérateur ${executor} a été banni pour tentative de bannissement en masse.**\n\n📋 **Membres affectés avant la neutralisation :**\n${affectedMembers.join('\n')}\n\n*Utilisez les boutons ci-dessous pour annuler la sanction et réinviter automatiquement les membres affectés.*`)
                            .addFields(
                                { name: '👑 Sanctionné', value: `${executor.tag} (\`${executor.id}\`)`, inline: true },
                                { name: '📊 Volume', value: `\`${recentBans.length}\` bannissements / 10s`, inline: true }
                            )
                            .setThumbnail(executor.displayAvatarURL())
                            .setTimestamp();

                        await logChannel.send({
                            content: `🚨 <@${guild.ownerId}> **ALERTE SÉCURITÉ : Tentative de bannissement en masse neutralisée !**`,
                            embeds: [nukeEmbed],
                            components: [nukeRow]
                        }).catch(() => null);
                    }
                }
            }
        } catch (error) {
            console.error('[GUILD_BAN_ADD ERROR]', error);
        }
    }
};