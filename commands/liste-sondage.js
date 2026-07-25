const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Sondage = require('../models/Sondage'); // 👈 Import du modèle Mongoose

module.exports = {
    data: new SlashCommandBuilder()
        .setName('liste-sondage')
        .setDescription('📊 Voir les détails des votes d\'un sondage')
        .addIntegerOption(opt => opt
            .setName('numero')
            .setDescription('Numéro du sondage (1 = le plus récent, défaut)')
            .setRequired(false)
            .setMinValue(1)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const aLeGrade = interaction.member.roles.cache.some(r => (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim()).includes(r.id));
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        try {
            // 🍃 Récupération des sondages depuis MongoDB (du plus récent au plus ancien)
            const sondages = await Sondage.find().sort({ createdAt: -1 });

            if (!sondages || sondages.length === 0)
                return interaction.editReply({ content: '❌ Aucun sondage enregistré pour le moment.' });

            const numero = interaction.options.getInteger('numero') || 1;
            
            // Tri du plus récent au plus ancien : index 0 = n°1 (le plus récent)
            const sondageData = sondages[numero - 1];

            if (!sondageData)
                return interaction.editReply({ content: `❌ Sondage n°${numero} introuvable. Il y a **${sondages.length}** sondage(s) enregistré(s).` });

            const channel = await interaction.client.channels.fetch(sondageData.channelId);
            const message = await channel.messages.fetch(sondageData.messageId);

            const embed = new EmbedBuilder()
                .setTitle(`📊 Votes — ${sondageData.question}`)
                .setDescription(`Sondage créé le **${sondageData.date}** dans <#${sondageData.channelId}>`)
                .setColor('#4A90D9')
                .setTimestamp()
                .setFooter({ text: `Gurenkai • Récupéré par ${interaction.user.username}` });

            function truncate(list) {
                if (list.length === 0) return '*Aucun vote*';
                const str = list.join('\n');
                return str.length > 900 ? str.slice(0, 900) + `\n*... +${list.length - str.slice(0, 900).split('\n').length} autres*` : str;
            }

            const reactions = message.reactions.cache;
            
            if (reactions.size === 0) {
                embed.addFields({ name: "Votes", value: "Personne n'a encore voté !" });
            } else {
                for (const [emoji, reaction] of reactions) {
                    const users = await reaction.users.fetch();
                    const voters = users.filter(u => !u.bot).map(u => `<@${u.id}>`);

                    embed.addFields({
                        name: `${emoji} (${voters.length} vote${voters.length > 1 ? 's' : ''})`,
                        value: truncate(voters),
                        inline: true
                    });
                }
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (e) {
            console.error('[LISTE-SONDAGE]', e);
            await interaction.editReply({ content: '❌ Impossible de récupérer les votes. Le message a peut-être été supprimé.' });
        }
    }
};