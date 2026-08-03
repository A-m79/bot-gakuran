const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage) {
        // 1. Vérification de la guilde
        if (!newMessage || !newMessage.guild) return;

        // 2. On récupère l'auteur via newMessage (toujours plus fiable) ou oldMessage
        const author = newMessage.author || oldMessage.author;
        
        // 3. Si aucun auteur trouvé ou si c'est un bot, on s'arrête net (anti-crash)
        if (!author || author.bot) return;

        // 4. Ignore si le contenu n'a pas changé (ex: lien qui génère une image/embed)
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
    }
};