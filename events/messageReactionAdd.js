const { EmbedBuilder } = require('discord.js');
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
                // 1️⃣ VERROU MÉMOIRE IMMÉDIAT (Avant le moindre 'await')
                if (processingChecks.has(reaction.message.id)) return;
                processingChecks.add(reaction.message.id);

                // 2️⃣ Vérification si l'activity check existe et n'est pas encore atteinte
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
                            // 3️⃣ VERROU ATOMIQUE MONGODB (Seul le 1er exécuté réussira l'update)
                            const updatedCheck = await ActivityCheck.findOneAndUpdate(
                                { messageId: reaction.message.id, reached: { $ne: true } },
                                { $set: { reached: true } },
                                { new: true }
                            );

                            // Si updatedCheck existe, c'est NOUS qui avons validé l'objectif en premier
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

            // ─── SYSTÈME 2 : REACTION ROLE (tous emojis, indépendant de l'activity check) ───
            const guild = reaction.message.guild;
            if (guild) {
                const rr = await ReactionRole.findOne({ messageId: reaction.message.id });
                if (rr && rr.bindings.length > 0) {
                    const emojiKey = reaction.emoji.id ? reaction.emoji.id : reaction.emoji.name;
                    const binding = rr.bindings.find(b => b.emoji === emojiKey || b.emoji === reaction.emoji.toString());

                    if (binding) {
                        const member = await guild.members.fetch(user.id).catch(() => null);
                        if (member) {
                            // Mode exclusif : retire les autres rôles du même message avant d'ajouter le nouveau
                            if (rr.exclusive) {
                                const otherRoleIds = rr.bindings
                                    .filter(b => b.roleId !== binding.roleId)
                                    .map(b => b.roleId);

                                const rolesToRemove = otherRoleIds.filter(id => member.roles.cache.has(id));
                                if (rolesToRemove.length > 0) {
                                    await member.roles.remove(rolesToRemove).catch(() => null);

                                    for (const b of rr.bindings.filter(b => b.roleId !== binding.roleId)) {
                                        const otherReaction = reaction.message.reactions.cache.find(
                                            r => r.emoji.id === b.emoji || r.emoji.name === b.emoji || r.emoji.toString() === b.emoji
                                        );
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
                    }
                }
            }

        } catch (err) {
            console.error('[MESSAGE REACTION ADD ERROR]', err);
            if (reaction.message?.id) processingChecks.delete(reaction.message.id);
        }
    }
};