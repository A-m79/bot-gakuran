const { EmbedBuilder, AuditLogEvent, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const recentKicksMap = new Map();
const KICK_THRESHOLD = 1;
const KICK_TIME_WINDOW = 10000;

module.exports = {
    name: 'guildMemberRemove',
    async execute(member) {
        const guild = member.guild;
        const now = Date.now();

        const logChannelId = process.env.SECURITY_LOGS_CHANNEL_ID?.trim();
        const logChannel = logChannelId ? await guild.channels.fetch(logChannelId).catch(() => null) : null;

        try {
            await new Promise(resolve => setTimeout(resolve, 1500));

            const fetchedLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberKick,
            }).catch(() => null);

            if (!fetchedLogs) return;

            const kickLog = fetchedLogs.entries.first();
            if (!kickLog) return;

            const { executor, target, createdAt, reason } = kickLog;

            if (target.id === member.id && (now - createdAt.getTime()) < 7000) {

                // ─── 1. LOG DE KICK INDIVIDUEL ───
                if (logChannel) {
                    const kickRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`reinvite_${member.id}`)
                            .setLabel('📩 Réinviter par MP')
                            .setStyle(ButtonStyle.Primary)
                    );

                    const kickLogEmbed = new EmbedBuilder()
                        .setTitle('👢 Membre Expulsé (Kick)')
                        .setColor('#FF9900')
                        .addFields(
                            { name: '👤 Membre expulsé', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
                            { name: '🛠️ Expulsé par', value: `${executor} (\`${executor.id}\`)`, inline: true },
                            { name: '📝 Raison', value: reason || 'Aucune raison fournie' }
                        )
                        .setTimestamp();

                    await logChannel.send({ embeds: [kickLogEmbed], components: [kickRow] }).catch(() => null);
                }

                if (executor.id === guild.ownerId || executor.id === guild.client.user.id) return;

                // ─── 2. ANTI-MASS KICK PRO ───
                const executorId = executor.id;
                if (!recentKicksMap.has(executorId)) {
                    recentKicksMap.set(executorId, []);
                }

                const userKicks = recentKicksMap.get(executorId);
                userKicks.push({ timestamp: now, targetId: member.id, targetTag: member.user.tag });

                const recentKicks = userKicks.filter(k => now - k.timestamp < KICK_TIME_WINDOW);
                recentKicksMap.set(executorId, recentKicks);

                if (recentKicks.length >= KICK_THRESHOLD) {
                    const executorMember = await guild.members.fetch(executorId).catch(() => null);

                    if (executorMember && executorMember.bannable) {
                        await executorMember.ban({ 
                            reason: `🚨 ANTI-NUKE : Mass Kick (${recentKicks.length} expulsions en 10s)` 
                        }).catch(() => null);

                        if (logChannel) {
                            const nukeRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`unban_${executor.id}`)
                                    .setLabel('🔓 Débannir le Modérateur')
                                    .setStyle(ButtonStyle.Danger)
                            );

                            const affectedMembers = [];
                            recentKicks.forEach((kickItem) => {
                                affectedMembers.push(`• <@${kickItem.targetId}> (\`${kickItem.targetTag}\`)`);
                                
                                if (nukeRow.components.length < 5) {
                                    const shortName = kickItem.targetTag.split('#')[0];
                                    nukeRow.addComponents(
                                        new ButtonBuilder()
                                            .setCustomId(`reinvite_${kickItem.targetId}`)
                                            .setLabel(`🔄 Rétablir ${shortName}`)
                                            .setStyle(ButtonStyle.Success)
                                    );
                                }
                            });

                            const nukeKickEmbed = new EmbedBuilder()
                                .setTitle('🚨 ALERTE ANTI-NUKE : MASS KICK DÉTECTÉ')
                                .setColor('#FF0000')
                                .setDescription(`**Le modérateur ${executor} a été banni pour tentative d'expulsion en masse.**\n\n📋 **Membres affectés avant la neutralisation :**\n${affectedMembers.join('\n')}\n\n*Utilisez les boutons ci-dessous pour annuler la sanction et envoyer automatiquement une invitation d'excuse par MP.*`)
                                .addFields(
                                    { name: '👑 Sanctionné', value: `${executor.tag} (\`${executor.id}\`)`, inline: true },
                                    { name: '📊 Volume', value: `\`${recentKicks.length}\` expulsions / 10s`, inline: true }
                                )
                                .setTimestamp();

                            await logChannel.send({
                                content: '🚨 @everyone **ALERTE SÉCURITÉ : Tentative d\'expulsion en masse neutralisée.**',
                                embeds: [nukeKickEmbed],
                                components: [nukeRow]
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