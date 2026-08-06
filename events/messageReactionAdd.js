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
            if (processingChecks.has(reaction.message.id)) return;

            const check = await ActivityCheck.findOne({ messageId: reaction.message.id, reached: false });
            if (!check) return;

            processingChecks.add(reaction.message.id);

            const users = await reaction.users.fetch().catch(() => null);
            if (!users) {
                processingChecks.delete(reaction.message.id);
                return;
            }

            const humanCount = users.filter(u => !u.bot).size;

            if (humanCount >= check.objectif) {
                check.reached = true;
                await check.save();

                const channel = await reaction.client.channels.fetch(check.channelId).catch(() => null);
                if (channel) {
                    const successEmbed = new EmbedBuilder()
                        .setTitle('🎉 OBJECTIF ATTEINT — GURENKAI')
                        .setDescription(`**${humanCount} membre(s)** ont répondu présent !\n\n> La guilde est mobilisée. Bien joué à tous ! 🔥`)
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

            processingChecks.delete(reaction.message.id);
        } catch (err) {
            console.error('[ACTIVITY CHECK CRITICAL ERROR]', err);
            if (reaction.message?.id) processingChecks.delete(reaction.message.id);
        }
    }
};