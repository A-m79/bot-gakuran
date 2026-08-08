const { EmbedBuilder, AuditLogEvent } = require('discord.js');

module.exports = {
    name: 'messageDelete',
    async execute(message) {
        if (!message.guild || message.author?.bot) return;

        const logChannelId = process.env.SECURITY_LOGS_CHANNEL_ID?.trim();
        if (!logChannelId) return;

        const logChannel = await message.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel) return;

        // 1️⃣ Formatage propre de l'auteur
        const authorText = message.author
            ? `${message.author} (\`${message.author.id}\`)`
            : '❓ *Auteur inconnu*';

        let deletedBy = '👤 L\'auteur *(ou suppression auto)*';

        // Pause pour laisser le temps à l'API Discord d'inscrire/mettre à jour l'Audit Log
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 2️⃣ Recherche dans les 5 derniers Audit Logs
        const fetchedLogs = await message.guild.fetchAuditLogs({
            limit: 5,
            type: AuditLogEvent.MessageDelete
        }).catch(err => {
            console.error('❌ [AUDIT LOG] Échec de fetchAuditLogs (probable permission "Voir le journal d\'audit" manquante) :', err.message);
            return null;
        });

        if (fetchedLogs) {
            // Recherche de l'entrée correspondant au salon et à l'auteur
            const deletionLog = fetchedLogs.entries.find(entry => {
                const matchesChannel = entry.extra?.channel?.id === message.channel.id;
                const matchesTarget = !message.author || entry.target?.id === message.author.id;
                // Fenêtre de 20s car la date du log ne change pas quand le modérateur enchaîne les suppressions
                const isRecent = (Date.now() - entry.createdTimestamp) < 20000;
                return matchesChannel && matchesTarget && isRecent;
            });

            if (deletionLog?.executor) {
                deletedBy = `${deletionLog.executor} (\`${deletionLog.executor.id}\`)`;
            } else {
                console.warn(`⚠️ [AUDIT LOG] ${fetchedLogs.entries.size} entrée(s) récupérée(s), mais aucune ne correspond pour le message de ${message.author?.tag || 'auteur inconnu'} dans #${message.channel?.name}.`);
            }
        } else {
            console.warn('⚠️ [AUDIT LOG] fetchedLogs est null — vérifie la permission "Voir le journal d\'audit" du bot.');
        }

        // 3️⃣ Contenu du message
        let contentText = message.content
            ? `\`\`\`${message.content.slice(0, 1000)}\`\`\``
            : '_Aucun texte (Image, Embed ou non-caché)_';

        if (message.attachments?.size > 0) {
            contentText += `\n📎 *[${message.attachments.size} fichier(s) joint(s)]*`;
        }

        // 4️⃣ Embed final
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
    }
};