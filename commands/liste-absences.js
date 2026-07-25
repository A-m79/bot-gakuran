const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('liste-absences')
        .setDescription('📋 Affiche la liste récapitulative des absences et leur statut'),

    async execute(interaction) {
        const filePath = path.join(__dirname, '..', 'data', 'absences.json');

        if (!fs.existsSync(filePath)) {
            return interaction.reply({
                content: '📂 Aucune absence enregistrée pour le moment.',
                ephemeral: true
            });
        }

        let absences = [];
        try {
            absences = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            return interaction.reply({
                content: '❌ Erreur lors de la lecture de la base de données des absences.',
                ephemeral: true
            });
        }

        if (!Array.isArray(absences) || absences.length === 0) {
            return interaction.reply({
                content: '📂 Aucune absence à afficher.',
                ephemeral: true
            });
        }

        const now = new Date();
        const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const getStatus = (dateDebutStr, dureeJours) => {
            const parts = dateDebutStr.split('/');
            let startDate;
            if (parts.length === 3) {
                startDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            } else {
                startDate = new Date(dateDebutStr);
            }

            const dureeInt = parseInt(dureeJours, 10) || 1;
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + dureeInt);

            const startMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const endMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

            if (nowMidnight < startMidnight) {
                return { badge: '⏳ À venir' };
            } else if (nowMidnight >= startMidnight && nowMidnight < endMidnight) {
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

        await interaction.reply({ embeds: [embed] });
    }
};