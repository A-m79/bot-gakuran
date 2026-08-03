const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageDelete',
    async execute(message) {
        if (!message.guild || message.author?.bot) return;

        const logChannelId = process.env.SECURITY_LOGS_CHANNEL_ID?.trim();
        if (!logChannelId) return;

        const logChannel = await message.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Message Supprimé')
            .setColor('#FF5555')
            .addFields(
                { name: '👤 Auteur', value: `${message.author} (\`${message.author?.id}\`)`, inline: true },
                { name: '📍 Salon', value: `${message.channel}`, inline: true },
                { name: '💬 Contenu', value: message.content ? `\`\`\`${message.content.slice(0, 1000)}\`\`\`` : '_Aucun texte (Image ou Embed)_' }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => null);
    }
};