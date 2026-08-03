const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage) {
        try {
            // Si le message est partiel, on tente de le récupérer en entier
            if (newMessage.partial) {
                newMessage = await newMessage.fetch().catch(() => null);
            }
            if (oldMessage?.partial) {
                oldMessage = await oldMessage.fetch().catch(() => null);
            }

            // Si l'un des deux n'a pas pu être résolu, on abandonne proprement
            if (!newMessage || !oldMessage) return;
            if (!newMessage.guild) return;
            if (!newMessage.channel) return;

            const author = newMessage.author || oldMessage.author;
            if (!author || author.bot) return;

            if (oldMessage.content === newMessage.content) return;

            const logChannelId = process.env.SECURITY_LOGS_CHANNEL_ID?.trim();
            if (!logChannelId) return;

            const logChannel = await newMessage.guild.channels.fetch(logChannelId).catch(() => null);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setTitle('✏️ Message Modifié')
                .setColor('#FFAA00')
                .addFields(
                    { name: '👤 Auteur', value: `${author} (\`${author.id}\`)`, inline: true },
                    { name: '📍 Salon', value: `${newMessage.channel}`, inline: true },
                    { name: '💬 Avant', value: `\`\`\`${oldMessage.content?.slice(0, 1000) || 'Ancien message non mis en cache'}\`\`\`` },
                    { name: '💬 Après', value: `\`\`\`${newMessage.content?.slice(0, 1000) || 'Inconnu'}\`\`\`` }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => null);

        } catch (err) {
            console.error('❌ Erreur dans messageUpdate :', err);
        }
    }
};