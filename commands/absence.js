const { 
    SlashCommandBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    EmbedBuilder, 
    AttachmentBuilder 
} = require('discord.js');
const path = require('path');

const ABSENCE_CHANNEL_ID = '1530476747622187190';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('absence')
        .setDescription('📝 Déclarer une absence officielle au sein du gang'),

    async execute(interaction) {
        // 1. Création du formulaire Modal
        const modal = new ModalBuilder()
            .setCustomId(`modal_absence_${interaction.user.id}`)
            .setTitle('📝 Déclaration d\'absence — Gurenkai');

        const ingameInput = new TextInputBuilder()
            .setCustomId('absence_ingame')
            .setLabel('Nom / Prénom en jeu (RP)')
            .setPlaceholder('Ex: Kenji Sato')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const durationInput = new TextInputBuilder()
            .setCustomId('absence_duration')
            .setLabel('Durée / Dates de l\'absence')
            .setPlaceholder('Ex: 3 jours (du 25/07 au 28/07)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const reasonInput = new TextInputBuilder()
            .setCustomId('absence_reason')
            .setLabel('Raison de l\'absence')
            .setPlaceholder('Ex: Examens, vacances, problème matériel...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(ingameInput),
            new ActionRowBuilder().addComponents(durationInput),
            new ActionRowBuilder().addComponents(reasonInput)
        );

        // Afficher le modal à l'utilisateur
        await interaction.showModal(modal);

        // 2. Attendre la soumission du formulaire (délai de 5 min)
        try {
            const submitted = await interaction.awaitModalSubmit({
                filter: i => i.customId === `modal_absence_${interaction.user.id}`,
                time: 300000
            });

            await submitted.deferReply({ ephemeral: true });

            const ingame = submitted.fields.getTextInputValue('absence_ingame');
            const duration = submitted.fields.getTextInputValue('absence_duration');
            const reason = submitted.fields.getTextInputValue('absence_reason');

            // Récupération du salon d'absence
            const channel = await interaction.client.channels.fetch(ABSENCE_CHANNEL_ID);
            if (!channel) {
                return submitted.editReply({ content: '❌ Erreur : Impossible de trouver le salon d\'absences.' });
            }

            const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });

            const embed = new EmbedBuilder()
                .setTitle('📋 NOUVELLE ABSENCE')
                .setColor('#FF9900')
                .setThumbnail('attachment://logo.png')
                .addFields(
                    { name: '👤 Membre Discord', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
                    { name: '🎮 Nom RP / En jeu', value: `\`${ingame}\``, inline: true },
                    { name: '⏳ Durée & Dates', value: `\`${duration}\``, inline: false },
                    { name: '📝 Raison', value: `>>> ${reason}`, inline: false }
                )
                .setFooter({ text: 'Gurenkai • Gestion du Gang' })
                .setTimestamp();

            await channel.send({ embeds: [embed], files: [logo] });

            return submitted.editReply({ content: '✅ Ta absence a bien été prise en compte !' });

        } catch (error) {
            // Si l'utilisateur ferme ou ne remplit pas dans le temps imparti
            return;
        }
    }
};