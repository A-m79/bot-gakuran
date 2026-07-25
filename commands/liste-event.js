const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Evenement = require('../models/Evenement');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('liste-event')
        .setDescription('📋 Voir les présences/absences d\'un événement')
        .addIntegerOption(opt => opt
            .setName('numero')
            .setDescription('Numéro de l\'événement (1 = le plus récent, défaut)')
            .setRequired(false)
            .setMinValue(1)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const aLeGrade = interaction.member.roles.cache.some(r => 
            (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim()).includes(r.id)
        );
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        // 🍃 Récupère les événements depuis MongoDB (du plus récent au plus ancien)
        const events = await Evenement.find().sort({ createdAt: -1 });

        if (events.length === 0)
            return interaction.editReply({ content: '❌ Aucun événement enregistré pour le moment.' });

        const numero = interaction.options.getInteger('numero') || 1;
        
        // Comme c'est trié du plus récent au plus ancien : index 0 = n°1 (le plus récent)
        const eventData = events[numero - 1];

        if (!eventData)
            return interaction.editReply({ content: `❌ Événement n°${numero} introuvable. Il y a **${events.length}** événement(s) enregistré(s).` });

        try {
            const channel = await interaction.client.channels.fetch(eventData.channelId);
            const message = await channel.messages.fetch(eventData.messageId);

            // Récupérer les utilisateurs de chaque réaction
            async function getUsers(emoji) {
                const reaction = message.reactions.cache.get(emoji);
                if (!reaction) return [];
                const users = await reaction.users.fetch();
                return users.filter(u => !u.bot).map(u => `<@${u.id}>`);
            }

            const presents = await getUsers('✅');
            const absents  = await getUsers('❌');
            const maybes   = await getUsers('❓');

            // Tronquer si trop long (limite Discord 1024 chars par field)
            function truncate(list) {
                if (list.length === 0) return '*Aucun*';
                const str = list.join('\n');
                return str.length > 900 ? str.slice(0, 900) + `\n*... +${list.length - str.slice(0, 900).split('\n').length} autres*` : str;
            }

            const embed = new EmbedBuilder()
                .setTitle(`📋 Présences — ${eventData.titre}`)
                .setDescription(`**Date :** ${eventData.date} à ${eventData.heure}\n**Lieu :** ${eventData.lieu}`)
                .setColor('#FFD700')
                .addFields(
                    { name: `✅ Présents (${presents.length})`, value: truncate(presents), inline: true },
                    { name: `❌ Absents (${absents.length})`,   value: truncate(absents),  inline: true },
                    { name: `❓ Peut-être (${maybes.length})`,  value: truncate(maybes),   inline: true },
                )
                .setFooter({ text: `Gurenkai • Événement du ${eventData.date} — Récupéré par ${interaction.user.username}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (e) {
            console.error('[LISTE-EVENT]', e);
            await interaction.editReply({ content: '❌ Impossible de récupérer les réactions. Le message a peut-être été supprimé.' });
        }
    }
};