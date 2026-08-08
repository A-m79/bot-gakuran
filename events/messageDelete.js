const { EmbedBuilder, AuditLogEvent } = require('discord.js');

module.exports = {
    name: 'messageDelete',
    async execute(message) {
        // Ignorer les MPs et les bots connus
        if (!message.guild || message.author?.bot) return;

        const logChannelId = process.env.SECURITY_LOGS_CHANNEL_ID?.trim();
        if (!logChannelId) return;

        const logChannel = await message.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel) return;

        // 1️⃣ Gestion propre de l'auteur (évite l'affichage null / undefined)
        const authorText = message.author 
            ? `${message.author} (\`${message.author.id}\`)` 
            : '❓ *Auteur inconnu (Non en cache)*';

        // 2️⃣ Identification de la personne qui a supprimé le message
        let deletedBy = '👤 L\'auteur *(ou suppression auto)*';

        // Attente de 1 seconde pour s'assurer que Discord a inscrit l'action dans l'Audit Log
        await new Promise(resolve => setTimeout(resolve, 1000));

        const fetchedLogs = await message.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MessageDelete
        }).catch(() => null);

        if (fetchedLogs) {
            const deletionLog = fetchedLogs.entries.first();
            if (deletionLog) {
                const { executor, target, extra, createdAt } = deletionLog;
                
                const isRecent = (Date.now() - createdAt.getTime()) < 5000; // Moins de 5 secondes
                const matchesChannel = extra?.channel?.id === message.channel.id;
                const matchesTarget = !message.author || target?.id === message.author.id;

                if (isRecent && matchesChannel && matchesTarget && executor) {
                    deletedBy = `${executor} (\`${executor.id}\`)`;
                }
            }
        }

        // 3️⃣ Formatage du contenu et détection des pièces jointes
        let contentText = message.content 
            ? `\`\`\`${message.content.slice(0, 1000)}\`\`\`` 
            : '_Aucun texte (Image, Embed ou non-caché)_';

        if (message.attachments?.size > 0) {
            contentText += `\n📎 *[${message.attachments.size} fichier(s) joint(s)]*`;
        }

        // 4️⃣ Construction de l'Embed de log
        const embed = new EmbedBuilder()
            .setTitle('🗑️ Message Supprimé')
            .setColor('#FF5555')
            .addFields(
                { name: '👤 Auteur', value: authorText, inline: true },
                { name: '🛡️ Supprimé par', value: deletedBy, inline: true },
                { name: '📍 Salon', value: `${message.channel}`, inline: true },
                { name: '💬 Contenu', value: contentText }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => null);
    }
};