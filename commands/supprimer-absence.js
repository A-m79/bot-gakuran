const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('supprimer-absence')
        .setDescription('🗑️ Supprimer une absence du registre')
        .addIntegerOption(option =>
            option.setName('numero')
                .setDescription('Le numéro de l\'absence affiché dans /liste-absences (ex: 1, 2...)')
                .setRequired(true)),

    async execute(interaction) {
        const numero = interaction.options.getInteger('numero');
        const filePath = path.join(__dirname, '..', 'data', 'absences.json');

        if (!fs.existsSync(filePath)) {
            return interaction.reply({
                content: '📂 Aucune absence enregistrée.',
                ephemeral: true
            });
        }

        let absences = [];
        try {
            absences = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            return interaction.reply({
                content: '❌ Erreur lors de la lecture de la base de données.',
                ephemeral: true
            });
        }

        if (!Array.isArray(absences) || absences.length === 0) {
            return interaction.reply({
                content: '📂 Le registre des absences est vide.',
                ephemeral: true
            });
        }

        const index = numero - 1;

        if (index < 0 || index >= absences.length) {
            return interaction.reply({
                content: `❌ Numéro invalide. Veuillez entrer un numéro entre **1** et **${absences.length}**.`,
                ephemeral: true
            });
        }

        const targetAbsence = absences[index];

        // Sécurité : Vérifie si c'est l'auteur de l'absence OU un admin/staff
        const isOwner = targetAbsence.userId === interaction.user.id;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) || 
                        interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isOwner && !isAdmin) {
            return interaction.reply({
                content: '❌ Tu ne peux supprimer que tes propres absences (seul le staff peut supprimer celles des autres).',
                ephemeral: true
            });
        }

        // Suppression dans le tableau
        const supprimee = absences.splice(index, 1)[0];

        // Enregistrement dans le fichier JSON
        fs.writeFileSync(filePath, JSON.stringify(absences, null, 2));

        const embed = new EmbedBuilder()
            .setTitle('🗑️ ABSENCE SUPPRIMÉE — GURENKAI')
            .setColor('#FF0000')
            .setDescription(`L'absence **n°${numero}** a bien été retirée du registre.`)
            .addFields(
                { name: '👤 Membre', value: `<@${supprimee.userId}>`, inline: true },
                { name: '🎮 Nom RP', value: `\`${supprimee.ingame || 'Non renseigné'}\``, inline: true },
                { name: '📅 Date', value: `\`${supprimee.dateDebut}\``, inline: true }
            )
            .setFooter({ text: 'Gurenkai • Registre mis à jour' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};