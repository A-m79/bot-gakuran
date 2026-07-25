const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Absence = require('../models/Absence'); // 👈 Import du modèle Mongoose

module.exports = {
    data: new SlashCommandBuilder()
        .setName('liste-absences')
        .setDescription('📋 Affiche la liste récapitulative des absences et leur statut'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // 🍃 Récupération de toutes les absences depuis MongoDB Atlas
            const absences = await Absence.find({});

            if (!absences || absences.length === 0) {
                return interaction.editReply({
                    content: '📂 Aucune absence enregistrée pour le moment.'
                });
            }

            const now = new Date();
            const currentYear = now.getFullYear();

            // Calculateur de statut intelligent
            const getStatus = (dateDebutStr, dureeJours) => {
                const match = String(dateDebutStr).match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);

                let startDate;
                if (match) {
                    const day = parseInt(match[1], 10);
                    const month = parseInt(match[2], 10) - 1; // Mois de 0 à 11
                    let year = match[3] ? parseInt(match[3], 10) : currentYear;
                    if (year < 100) year += 2000;

                    startDate = new Date(year, month, day);
                } else {
                    startDate = new Date(dateDebutStr);
                }

                if (isNaN(startDate.getTime())) {
                    return { badge: '❓ Date invalide' };
                }

                const dureeInt = parseInt(dureeJours, 10) || 1;
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + dureeInt);

                // Comparaison sans les heures (à minuit)
                const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const startMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                const endMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

                if (nowMidnight < startMidnight) {
                    return { badge: '⏳ À venir' };
                } else if (nowMidnight >= startMidnight && nowMidnight <= endMidnight) {
                    return { badge: '🟢 En cours' };
                } else {
                    return { badge: '🔴 Dépassée / Terminée' };
                }
            };

            const embed = new EmbedBuilder()
                .setTitle('📋 RÉCAPITULATIF DES ABSENCES — GURENKAI')
                .setColor('#3498DB')
                .setFooter({ text: `Total : ${absences.length} absence(s) au registre` })
                .setTimestamp();

            let description = '';

            absences.forEach((abs, index) => {
                const status = getStatus(abs.dateDebut, abs.duree);
                
                description += `**${index + 1}. <@${abs.userId}>** (${abs.ingame || 'Nom RP non renseigné'})\n`;
                description += `• **Statut :** ${status.badge}\n`;
                description += `• **Début :** \`${abs.dateDebut}\` | **Durée :** \`${abs.duree} jour(s)\`\n`;
                if (abs.raison) {
                    description += `• **Raison :** _${abs.raison}_\n`;
                }
                description += '\n';
            });

            embed.setDescription(description || 'Aucune absence enregistrée.');

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[ERREUR LISTE-ABSENCES]', error);
            await interaction.editReply({ 
                content: '❌ Une erreur est survenue lors de la récupération des absences depuis le cloud.' 
            });
        }
    }
};