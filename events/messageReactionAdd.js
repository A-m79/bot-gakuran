const { EmbedBuilder } = require('discord.js');
const ActivityCheck = require('../models/ActivityCheck');

const processingChecks = new Set();

module.exports = {
    name: 'messageReactionAdd',
    async execute(reaction, user, client) {
        if (user.bot) return;

        try {
            if (reaction.partial) await reaction.fetch().catch(() => null);
            if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

            if (reaction.emoji.name !== '✅') return;

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
                return;
            }

            const users = await reaction.users.fetch().catch(() => null);
            if (!users) {
                processingChecks.delete(reaction.message.id);
                return;
            }

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
        } catch (err) {
            console.error('[ACTIVITY CHECK CRITICAL ERROR]', err);
            if (reaction.message?.id) processingChecks.delete(reaction.message.id);
        }
    }
};