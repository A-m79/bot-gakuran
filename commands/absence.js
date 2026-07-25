const { 
    SlashCommandBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    EmbedBuilder, 
    AttachmentBuilder 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const ABSENCE_CHANNEL_ID = '1530476747622187190';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('absence')
        .setDescription('📝 Déclarer une absence '),

    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId(`modal_absence_${interaction.user.id}`)
            .setTitle('📝 Déclaration d\'absence — Gurenkai');

        const ingameInput = new TextInputBuilder()
            .setCustomId('absence_ingame')
            .setLabel('Nom / Prénom en jeu (RP)')
            .setPlaceholder('Ex: Kenji Sato')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const startDateInput = new TextInputBuilder()
            .setCustomId('absence_start')
            .setLabel('Date de début (JJ/MM/AAAA)')
            .setPlaceholder('Ex: 25/07/2026')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const durationInput = new TextInputBuilder()
            .setCustomId('absence_duration')
            .setLabel('Durée en jours')
            .setPlaceholder('Ex: 3 (pour 3 jours)')
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
            new ActionRowBuilder().addComponents(startDateInput),
            new ActionRowBuilder().addComponents(durationInput),
            new ActionRowBuilder().addComponents(reasonInput)
        );

        await interaction.showModal(modal);

        try {
            const submitted = await interaction.awaitModalSubmit({
                filter: i => i.customId === `modal_absence_${interaction.user.id}`,
                time: 300000
            });

            await submitted.deferReply({ ephemeral: true });

            const ingame = submitted.fields.getTextInputValue('absence_ingame');
            const dateDebut = submitted.fields.getTextInputValue('absence_start');
            const dureeStr = submitted.fields.getTextInputValue('absence_duration');
            const reason = submitted.fields.getTextInputValue('absence_reason');

            const duree = parseInt(dureeStr, 10) || 1;

            // Enregistrement dans data/absences.json
            const dataDir = path.join(__dirname, '..', 'data');
            const filePath = path.join(dataDir, 'absences.json');

            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

            let absences = [];
            if (fs.existsSync(filePath)) {
                try { absences = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { absences = []; }
            }

            absences.push({
                userId: interaction.user.id,
                ingame: ingame,
                dateDebut: dateDebut,
                duree: duree,
                raison: reason,
                createdAt: new Date().toISOString()
            });

            fs.writeFileSync(filePath, JSON.stringify(absences, null, 2));

            // Envoi dans le salon Discord
            const channel = await interaction.client.channels.fetch(ABSENCE_CHANNEL_ID);
            if (channel) {
                const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });

                const embed = new EmbedBuilder()
                    .setTitle('📋 NOUVELLE ABSENCE')
                    .setColor('#FF9900')
                    .setThumbnail('attachment://logo.png')
                    .addFields(
                        { name: '👤 Membre Discord', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
                        { name: '🎮 Nom RP / En jeu', value: `\`${ingame}\``, inline: true },
                        { name: '📅 Date de début', value: `\`${dateDebut}\``, inline: true },
                        { name: '⏳ Durée', value: `\`${duree} jour(s)\``, inline: true },
                        { name: '📝 Raison', value: `>>> ${reason}`, inline: false }
                    )
                    .setFooter({ text: 'Gurenkai • Gestion du Gang' })
                    .setTimestamp();

                await channel.send({ embeds: [embed], files: [logo] });
            }

            return submitted.editReply({ content: '✅ Ta déclaration d\'absence a bien été prise en compte !' });

        } catch (error) {
            return;
        }
    }
};