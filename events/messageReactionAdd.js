const { EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const ActivityCheck = require('../models/ActivityCheck');
const ReactionRole = require('../models/ReactionRole');

const processingChecks = new Set();

module.exports = {
    name: 'messageReactionAdd',
    async execute(reaction, user, client) {
        if (user.bot) return;

        try {
            if (reaction.partial) await reaction.fetch().catch(() => null);
            if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

            // ─── SYSTÈME 1 : ACTIVITY CHECK (uniquement sur l'emoji ✅) ───
            if (reaction.emoji.name === '✅') {
                if (processingChecks.has(reaction.message.id)) return;
                processingChecks.add(reaction.message.id);

                const check = await ActivityCheck.findOne({
                    messageId: reaction.message.id,
                    reached: { $ne: true }
                });

                if (!check) {
                    processingChecks.delete(reaction.message.id);
                } else {
                    const users = await reaction.users.fetch().catch(() => null);
                    if (!users) {
                        processingChecks.delete(reaction.message.id);
                    } else {
                        const humanCount = users.filter(u => !u.bot).size;

                        if (humanCount >= check.objectif) {
                            const updatedCheck = await ActivityCheck.findOneAndUpdate(
                                { messageId: reaction.message.id, reached: { $ne: true } },
                                { $set: { reached: true } },
                                { new: true }
                            );

                            if (updatedCheck) {
                                const channel = await reaction.client.channels.fetch(check.channelId).catch(() => null);
                                if (channel) {
                                    const successEmbed = new EmbedBuilder()
                                        .setTitle('🎉 OBJECTIF ATTEINT — GURENKAI')
                                        .setDescription(`**${humanCount} membre(s)** ont réagit !\n\n> Vous etes en place ^^. Bien joué à tous ! 🔥`)
                                        .setColor('#00FF88')
                                        .addFields(
                                            { name: '🎯 Objectif fixé', value: `${check.objectif} réactions`, inline: true },
                                            { name: '✅ Réponses reçues', value: `${humanCount} membres`, inline: true },
                                        )
                                        .setFooter({ text: 'Gurenkai Gang • Activity Check V2' })
                                        .setTimestamp();

                                    await channel.send({
                                        content: '🎊 **Objectif atteint !** @everyone',
                                        embeds: [successEmbed],
                                        allowedMentions: { parse: ['everyone'] }
                                    });
                                }
                            }
                        }
                        processingChecks.delete(reaction.message.id);
                    }
                }
            }

            // ─── SYSTÈME 2 : REACTION ROLE ───
            const guild = reaction.message.guild;
            if (guild) {
                const rr = await ReactionRole.findOne({ messageId: reaction.message.id });
                if (rr) {
                    const emojiKey = reaction.emoji.toString();
                    const binding = rr.bindings.find(b => b.emoji === emojiKey);

                    if (binding) {
                        // ── Cas normal : emoji déjà configuré → on donne le rôle ──
                        const member = await guild.members.fetch(user.id).catch(() => null);
                        if (member) {
                            if (rr.exclusive) {
                                const otherRoleIds = rr.bindings
                                    .filter(b => b.roleId !== binding.roleId)
                                    .map(b => b.roleId);

                                const rolesToRemove = otherRoleIds.filter(id => member.roles.cache.has(id));
                                if (rolesToRemove.length > 0) {
                                    await member.roles.remove(rolesToRemove).catch(() => null);

                                    for (const b of rr.bindings.filter(b => b.roleId !== binding.roleId)) {
                                        const otherReaction = reaction.message.reactions.cache.find(r => r.emoji.toString() === b.emoji);
                                        if (otherReaction) await otherReaction.users.remove(user.id).catch(() => null);
                                    }
                                }
                            }

                            if (!member.roles.cache.has(binding.roleId)) {
                                await member.roles.add(binding.roleId).catch(err =>
                                    console.error('❌ Erreur attribution rôle-réaction :', err)
                                );
                            }
                        }
                    } else {
                        // ── Emoji pas encore configuré ──
                        const member = await guild.members.fetch(user.id).catch(() => null);
                        const isManager = member?.permissions.has(PermissionFlagsBits.ManageRoles);

                        if (isManager) {
                            // Un admin vient de réagir pour CONFIGURER cet emoji : on retire sa réaction de test
                            // et on lui envoie en MP un menu pour choisir le rôle à associer.
                            await reaction.users.remove(user.id).catch(() => null);

                            const roleSelect = new RoleSelectMenuBuilder()
                                .setCustomId(`rr_roleselect_${reaction.message.id}::${encodeURIComponent(emojiKey)}`)
                                .setPlaceholder('Choisis le rôle à associer')
                                .setMinValues(1)
                                .setMaxValues(1);

                            const row = new ActionRowBuilder().addComponents(roleSelect);

                            await user.send({
                                content: `Tu as réagi avec ${emojiKey} sur le message de rôles-réactions.\nChoisis le rôle à associer à cet emoji :`,
                                components: [row]
                            }).catch(() => {
                                console.warn(`⚠️ Impossible d'envoyer un MP à ${user.tag} pour la config reaction-role (MP fermés ?).`);
                            });
                        } else {
                            // Un membre normal a réagi avec un emoji non configuré : on retire, ça ne sert à rien
                            await reaction.users.remove(user.id).catch(() => null);
                        }
                    }
                }
            }

        } catch (err) {
            console.error('[MESSAGE REACTION ADD ERROR]', err);
            if (reaction.message?.id) processingChecks.delete(reaction.message.id);
        }
    }
};