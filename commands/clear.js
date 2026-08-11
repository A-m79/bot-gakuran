const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('🗑️ Supprimer un certain nombre de messages')
        .addIntegerOption(opt => opt
            .setName('nombre')
            .setDescription('Nombre de messages à supprimer (1-100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
        .addUserOption(opt => opt
            .setName('membre')
            .setDescription('Supprimer uniquement les messages de ce membre (optionnel)')
            .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const authorizedRoles = process.env.AUTHORIZED_ROLE_IDS?.split(',').map(id => id.trim()) || [];
        const aLeGrade = interaction.member.roles.cache.some(r => authorizedRoles.includes(r.id));
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        const nombre = interaction.options.getInteger('nombre');
        const cible  = interaction.options.getUser('membre');

        try {
            // Récupérer les messages
            const messages = await interaction.channel.messages.fetch({ limit: cible ? 100 : nombre });

            let toDelete = [...messages.values()];

            // Filtrer par membre si précisé
            if (cible) {
                toDelete = toDelete.filter(m => m.author.id === cible.id).slice(0, nombre);
            }

            if (toDelete.length === 0) {
                return interaction.editReply({ content: '⚠️ Aucun message à supprimer avec ces critères.' });
            }

            // 📋 On capture le contenu AVANT suppression, pour le log + le transcript
            // (tri chronologique croissant pour que le transcript se lise naturellement)
            const capturedMessages = [...toDelete].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            // Discord ne peut supprimer en masse que les msgs de moins de 14 jours
            const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const recent = toDelete.filter(m => m.createdTimestamp > cutoff);
            const old    = toDelete.filter(m => m.createdTimestamp <= cutoff);

            let supprimés = 0;

            if (recent.length > 0) {
                if (recent.length === 1) {
                    await recent[0].delete();
                    supprimés += 1;
                } else {
                    const deleted = await interaction.channel.bulkDelete(recent, true);
                    supprimés += deleted.size;
                }
            }

            // Supprimer les vieux messages un par un
            for (const msg of old) {
                await msg.delete().catch(() => null);
                supprimés++;
            }

            const txt = cible
                ? `✅ **${supprimés}** message(s) de ${cible} supprimé(s).`
                : `✅ **${supprimés}** message(s) supprimé(s).`;

            await interaction.editReply({ content: txt });

            // ─── 📊 LOG DÉTAILLÉ + TRANSCRIPT ───
            await logClearAction(interaction, capturedMessages, supprimés, cible);

        } catch (e) {
            console.error('[CLEAR]', e);
            await interaction.editReply({ content: '❌ Erreur lors de la suppression. Vérifie que le bot a la permission "Gérer les messages".' });
        }
    }
};

async function logClearAction(interaction, capturedMessages, supprimés, cible) {
    const logChannelId = process.env.CLEAR_LOGS_CHANNEL_ID?.trim() || '1536800831612133428';

    const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
    if (!logChannel) return;

    // 📊 Répartition par auteur
    const breakdown = new Map(); // authorId -> { tag, count }
    for (const msg of capturedMessages) {
        const authorId = msg.author?.id || 'unknown';
        const tag = msg.author?.tag || 'Auteur inconnu';
        if (!breakdown.has(authorId)) breakdown.set(authorId, { tag, count: 0 });
        breakdown.get(authorId).count++;
    }

    const sortedBreakdown = [...breakdown.values()].sort((a, b) => b.count - a.count);
    const breakdownText = sortedBreakdown
        .slice(0, 10) // évite un embed trop long si beaucoup d'auteurs différents
        .map(b => `• **${b.tag}** — ${b.count} message(s)`)
        .join('\n') || 'Aucune donnée';

    const extraCount = sortedBreakdown.length > 10 ? `\n*+ ${sortedBreakdown.length - 10} autre(s) auteur(s)*` : '';

    // 📄 Transcript téléchargeable
    let transcriptText = `--- TRANSCRIPT DE SUPPRESSION MASSIVE ---\n`;
    transcriptText += `Salon : #${interaction.channel.name}\n`;
    transcriptText += `Modérateur : ${interaction.user.tag} (${interaction.user.id})\n`;
    transcriptText += `Date : ${new Date().toLocaleString('fr-FR')}\n`;
    transcriptText += `Messages supprimés : ${supprimés}\n`;
    transcriptText += `----------------------------------------\n\n`;

    for (const msg of capturedMessages) {
        const time = new Date(msg.createdTimestamp).toLocaleString('fr-FR');
        const author = msg.author ? `${msg.author.tag} (${msg.author.id})` : 'Auteur inconnu';
        const content = msg.content?.trim() || '_(pas de texte — image/embed/fichier)_';
        transcriptText += `[${time}] ${author}\n${content}\n`;
        if (msg.attachments?.size > 0) {
            transcriptText += `📎 ${msg.attachments.size} fichier(s) joint(s) :\n`;
            msg.attachments.forEach(a => transcriptText += `   - ${a.url}\n`);
        }
        transcriptText += `\n`;
    }

    const buffer = Buffer.from(transcriptText, 'utf-8');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const attachment = new AttachmentBuilder(buffer, { name: `clear-${interaction.channel.name}-${timestamp}.txt` });

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Suppression Massive de Messages')
        .setColor('#FF9900')
        .addFields(
            { name: '🛡️ Modérateur', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
            { name: '📍 Salon', value: `${interaction.channel}`, inline: true },
            { name: '🔢 Total supprimé', value: `${supprimés} message(s)`, inline: true },
            ...(cible ? [{ name: '🎯 Filtré sur', value: `${cible}`, inline: true }] : []),
            { name: '📊 Répartition par auteur', value: breakdownText + extraCount, inline: false }
        )
        .setFooter({ text: 'Gurenkai Security • Log de modération' })
        .setTimestamp();

    await logChannel.send({ embeds: [embed], files: [attachment] }).catch(err =>
        console.error('❌ Erreur envoi log clear :', err)
    );
}