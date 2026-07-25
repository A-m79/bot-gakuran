const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Absence = require('../models/Absence'); // 👈 Import du modèle Mongoose

module.exports = {
    data: new SlashCommandBuilder()
        .setName('supprimer-absence')
        .setDescription('🗑️ Supprimer une absence du registre')
        .addIntegerOption(option =>
            option.setName('numero')
                .setDescription('Le numéro de l\'absence affiché dans /liste-absences (ex: 1, 2...)')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const numero = interaction.options.getInteger('numero');

        try {
            // 🍃 Récupération de toutes les absences depuis MongoDB
            const absences = await Absence.find({});

            if (!absences || absences.length === 0) {
                return interaction.editReply({
                    content: '📂 Le registre des absences est vide.'
                });
            }

            const index = numero - 1;

            if (index < 0 || index >= absences.length) {
                return interaction.editReply({
                    content: `❌ Numéro invalide. Veuillez entrer un numéro entre **1** et **${absences.length}**.`
                });
            }

            const targetAbsence = absences[index];

            // Sécurité : Vérifie si c'est l'auteur de l'absence OU un admin/staff
            const isOwner = targetAbsence.userId === interaction.user.id;
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) || 
                            interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isOwner && !isAdmin) {
                return interaction.editReply({
                    content: '❌ Tu ne peux supprimer que tes propres absences (seul le staff peut supprimer celles des autres).'
                });
            }

            // 🍃 Suppression de l'élément spécifique de MongoDB grâce à son _id unique
            await Absence.findByIdAndDelete(targetAbsence._id);

            const embed = new EmbedBuilder()
                .setTitle('🗑️ ABSENCE SUPPRIMÉE — GURENKAI')
                .setColor('#FF0000')
                .setDescription(`L'absence **n°${numero}** a bien été retirée du registre cloud.`)
                .addFields(
                    { name: '👤 Membre', value: `<@${targetAbsence.userId}>`, inline: true },
                    { name: '🎮 Nom RP', value: `\`${targetAbsence.ingame || 'Non renseigné'}\``, inline: true },
                    { name: '📅 Date', value: `\`${targetAbsence.dateDebut}\``, inline: true }
                )
                .setFooter({ text: 'Gurenkai • Registre mis à jour' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[ERREUR SUPPRIMER-ABSENCE]', error);
            await interaction.editReply({
                content: '❌ Une erreur est survenue lors de la suppression de l\'absence.'
            });
        }
    }
};