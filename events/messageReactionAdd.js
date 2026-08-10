const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
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

            // ─── SYSTÈME 1 : ACTIVITY CHECK ───
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
                        const member = await guild.members.fetch(user.id).catch(() => null);
                        if (!member) return;

                        const newRole = await guild.roles.fetch(binding.roleId).catch(() => null);
                        if (!newRole) return;

                        let removedRoleNames = [];

                        // Mode exclusif : retrait des anciens rôles
                        if (rr.exclusive) {
                            const otherBindings = rr.bindings.filter(b => b.roleId !== binding.roleId);
                            const otherRoleIds = otherBindings.map(b => b.roleId);

                            const rolesToRemove = otherRoleIds.filter(id => member.roles.cache.has(id));

                            if (rolesToRemove.length > 0) {
                                for (const roleId of rolesToRemove) {
                                    const roleObj = member.roles.cache.get(roleId);
                                    if (roleObj) removedRoleNames.push(roleObj.name);
                                }

                                await member.roles.remove(rolesToRemove).catch(() => null);

                                for (const b of otherBindings) {
                                    const otherReaction = reaction.message.reactions.cache.find(r => r.emoji.toString() === b.emoji);
                                    if (otherReaction) await otherReaction.users.remove(user.id).catch(() => null);
                                }
                            }
                        }

                        // Attribution du nouveau rôle
                        let roleAdded = false;
                        if (!member.roles.cache.has(binding.roleId)) {
                            await member.roles.add(binding.roleId).catch(err =>
                                console.error('❌ Erreur attribution rôle-réaction :', err)
                            );
                            roleAdded = true;
                        }

                        // Notification par Message Privé (MP)
                        if (roleAdded) {
                            if (removedRoleNames.length > 0) {
                                await user.send(
                                    `🔄 Le rôle **${removedRoleNames.join(', ')}** vous a été retiré et le rôle **${newRole.name}** vous a été attribué sur **${guild.name}**.`
                                ).catch(() => null);
                            } else {
                                await user.send(
                                    `✅ Le rôle **${newRole.name}** vous a été attribué sur **${guild.name}**.`
                                ).catch(() => null);
                            }
                        }

                    } else {
                        // Emoji non configuré
                        const member = await guild.members.fetch(user.id).catch(() => null);
                        const isManager = member?.permissions.has(PermissionFlagsBits.ManageRoles);

                        if (isManager) {
                            await reaction.users.remove(user.id).catch(() => null);

                            const row = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`rr_setup_${reaction.message.id}::${encodeURIComponent(emojiKey)}`)
                                    .setLabel(`Associer un rôle à ${reaction.emoji.name}`)
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji(reaction.emoji.id || reaction.emoji.name)
                            );

                            const promptMsg = await reaction.message.channel.send({
                                content: `⚙️ ${user}, clique sur le bouton ci-dessous pour choisir le rôle à associer à l'émoji ${emojiKey} :`,
                                components: [row]
                            }).catch(() => null);

                            if (promptMsg) {
                                setTimeout(() => promptMsg.delete().catch(() => null), 15000); // Auto-suppression après 15 sec
                            }
                        } else {
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