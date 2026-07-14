const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('🔨 Créer un embed stylisé avec des vrais sauts de ligne')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        const modal = new ModalBuilder()
            .setCustomId('embed_builder_modal')
            .setTitle('🔨 Créateur d\'Embed Gurenkai');

        // 1. Le Titre (Optionnel)
        const titreInput = new TextInputBuilder()
            .setCustomId('embed_titre')
            .setLabel('Titre de l\'embed')
            .setPlaceholder('Ex: ANNONCE IMPORTANTE 📢')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        // 2. Le Message (Obligatoire - Style PARAGRAPHE pour le copier-coller !)
        const messageInput = new TextInputBuilder()
            .setCustomId('embed_message')
            .setLabel('Message (Sauts de lignes autorisés !)')
            .setPlaceholder('Collez votre texte ici...\nVous pouvez appuyer sur Entrée pour sauter des lignes !')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        // 3. La Couleur (Optionnel)
        const couleurInput = new TextInputBuilder()
            .setCustomId('embed_couleur')
            .setLabel('Couleur Hex (Optionnel)')
            .setPlaceholder('Ex: #FF2A7A (par défaut)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        // 4. Grande Image (Optionnel)
        const imageInput = new TextInputBuilder()
            .setCustomId('embed_image')
            .setLabel('Lien d\'une grande image (Optionnel)')
            .setPlaceholder('https://...')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        // 5. Miniature (Optionnel)
        const thumbnailInput = new TextInputBuilder()
            .setCustomId('embed_miniature')
            .setLabel('Lien d\'une miniature en haut (Optionnel)')
            .setPlaceholder('https://...')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titreInput),
            new ActionRowBuilder().addComponents(messageInput),
            new ActionRowBuilder().addComponents(couleurInput),
            new ActionRowBuilder().addComponents(imageInput),
            new ActionRowBuilder().addComponents(thumbnailInput)
        );

        await interaction.showModal(modal);
    }
};