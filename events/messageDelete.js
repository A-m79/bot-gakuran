const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const LoggedMessage = require('../models/LoggedMessage');

module.exports = {
    name: 'messageDelete',
    async execute(message) {
        if (!message.guild || message.author?.bot) return;

        const logChannelId = process.env.SECURITY_LOGS_CHANNEL_ID?.trim();
        if (!logChannelId) return;

        const logChannel = await message.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel) return;

        // 🔍 Recherche du message dans MongoDB si non présent dans le cache
        const savedMessage = await LoggedMessage.findOne({ messageId: message.id }).catch(() => null);

        // 1️⃣ Extraction de l'Auteur
        let authorText = '❓ *Auteur inconnu*';
        let targetAuthorId = null;

        if (message.author) {
            authorText = `${message.author} (\`${message.author.id}\`)`;
            targetAuthorId = message.author.id;
        } else if (savedMessage) {
            authorText = `<@${savedMessage.authorId}> (\`${savedMessage.authorId}\`) — *${savedMessage.authorTag}*`;
            targetAuthorId = savedMessage.authorId;
        }

        // 2️⃣ Extraction du Contenu
        let rawContent = message.content || savedMessage?.content || '';
        let contentText = rawContent
            ? `\`\`\`${rawContent.slice(0, 1000)}\`\`\``
            : '_Aucun texte (Image, Embed ou non-caché)_';

        const attachmentCount = message.attachments?.size || savedMessage?.attachments?.length || 0;
        if (attachmentCount > 0) {
            contentText += `\n📎 *[${attachmentCount} fichier(s) joint(s)]*`;
        }

        // 3️⃣ Recherche dans l'Audit Log (Modérateur qui a supprimé)
        // Si aucun log d'audit n'existe, c'est obligatoirement l'auteur lui-même
        let deletedBy = targetAuthorId 
            ? `<@${targetAuthorId}> *(L'auteur lui-même)*` 
            : '👤 L\'auteur du message';

        await new Promise(resolve => setTimeout(resolve, 2000));

        const fetchedLogs = await message.guild.fetchAuditLogs({
            limit: 5,
            type: AuditLogEvent.MessageDelete
        }).catch(() => null);

        if (fetchedLogs) {
            const deletionLog = fetchedLogs.entries.find(entry => {
                const matchesChannel = entry.extra?.channel?.id === message.channel.id;
                const matchesTarget = !targetAuthorId || entry.target?.id === targetAuthorId;
                const isRecent = (Date.now() - entry.createdTimestamp) < 20000;
                return matchesChannel && matchesTarget && isRecent;
            });

            if (deletionLog?.executor) {
                deletedBy = `${deletionLog.executor} (\`${deletionLog.executor.id}\`)`;
            }
        }

        // 4️⃣ Envoi du Log
        const embed = new EmbedBuilder()
            .setTitle('🗑️ Message Supprimé')
            .setColor('#FF5555')
            .addFields(
                { name: '👤 Auteur', value: authorText, inline: true },
                { name: '🛡️ Supprimé par', value: deletedBy, inline: true },
                { name: '📍 Salon', value: `${message.channel}`, inline: false },
                { name: '💬 Contenu', value: contentText }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => null);

        // Nettoyage de la DB
        if (savedMessage) {
            await LoggedMessage.deleteOne({ messageId: message.id }).catch(() => null);
        }
    }
};