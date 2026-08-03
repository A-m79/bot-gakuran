const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage) {
        if (!oldMessage.guild || oldMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return; // Ignore les modifications automatiques d'embeds

        const logChannelId = process.env.SECURITY_LOGS_CHANNEL_ID?.trim();
        if (!logChannelId) return;

        const logChannel = await oldMessage.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('✏️ Message Modifié')
            .setColor('#FFAA00')
            .addFields(
                { name: '👤 Auteur', value: `${oldMessage.author} (\`${oldMessage.author.id}\`)`, inline: true },
                { name: '📍 Salon', value: `${oldMessage.channel}`, inline: true },
                { name: '💬 Avant', value: `\`\`\`${oldMessage.content?.slice(0, 1000) || 'Inconnu'}\`\`\`` },
                { name: '💬 Après', value: `\`\`\`${newMessage.content?.slice(0, 1000) || 'Inconnu'}\`\`\`` }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => null);
    }
};