const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '..', 'data', 'evenements.json');

const TYPE_CONFIG = {
    raid:         { emoji: '⚔️',  label: 'Raid',           color: '#E74C3C' },
    reunion:      { emoji: '🤝',  label: 'Réunion',        color: '#3498DB' },
    entrainement: { emoji: '🏋️', label: 'Entraînement',   color: '#2ECC71' },
    session:      { emoji: '🎮',  label: 'Session de jeu', color: '#9B59B6' },
    autre:        { emoji: '📋',  label: 'Autre',          color: '#FFD700' },
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('evenement')
        .setDescription('🗓️ Annoncer un événement officiel du gang')
        .addStringOption(opt => opt.setName('titre').setDescription('Titre de l\'événement').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Description').setRequired(true))
        .addStringOption(opt => opt.setName('date').setDescription('Date (ex: 25/07/2026)').setRequired(true))
        .addStringOption(opt => opt.setName('heure').setDescription('Heure (ex: 20:00)').setRequired(true))
        .addStringOption(opt => opt
            .setName('type')
            .setDescription('Type d\'événement')
            .setRequired(true)
            .addChoices(
                { name: '⚔️ Raid',           value: 'raid'         },
                { name: '🤝 Réunion',         value: 'reunion'      },
                { name: '🏋️ Entraînement',  value: 'entrainement' },
                { name: '🎮 Session de jeu', value: 'session'      },
                { name: '📋 Autre',           value: 'autre'        },
            )
        )
        .addStringOption(opt => opt.setName('lieu').setDescription('Lieu (optionnel)').setRequired(false))
        .addStringOption(opt => opt.setName('ping').setDescription('Rôle à mentionner (optionnel)').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        const aLeGrade = interaction.member.roles.cache.some(r => (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim()).includes(r.id));
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        const titre       = interaction.options.getString('titre');
        const description = interaction.options.getString('description');
        const date        = interaction.options.getString('date');
        const heure       = interaction.options.getString('heure');
        const type        = interaction.options.getString('type');
        const lieu        = interaction.options.getString('lieu') || 'À définir';
        const ping        = interaction.options.getString('ping') || '';

        const tc   = TYPE_CONFIG[type];
        const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });

        const embed = new EmbedBuilder()
            .setTitle(`${tc.emoji} ÉVÉNEMENT — ${titre.toUpperCase()}`)
            .setDescription(`>>> ${description}`)
            .setColor(tc.color)
            .setThumbnail('attachment://logo.png')
            .addFields(
                { name: '─'.repeat(30), value: '\u200B', inline: false },
                { name: '📅 Date',         value: date,                                                              inline: true },
                { name: '⏰ Heure',        value: heure,                                                             inline: true },
                { name: '📍 Lieu',         value: lieu,                                                              inline: true },
                { name: '🏷️ Type',        value: `${tc.emoji} ${tc.label}`,                                         inline: true },
                { name: '👮 Organisé par', value: `${interaction.user} (${interaction.member.roles.highest.name})`,  inline: true },
                { name: '─'.repeat(30), value: '\u200B',                                                            inline: false },
                { name: '📩 Présence',     value: '✅ Présent   ❌ Absent   ❓ Peut-être',                           inline: false },
            )
            .setFooter({ text: 'Gurenkai • Événement officiel' })
            .setTimestamp();

        await interaction.editReply({
            content: ping ? `📣 **ÉVÉNEMENT** — ${ping}` : '📣 **ÉVÉNEMENT OFFICIEL**',
            embeds: [embed],
            files: [logo],
            allowedMentions: { parse: ['roles', 'everyone'] }
        });

        const msg = await interaction.fetchReply();
        await msg.react('✅');
        await msg.react('❌');
        await msg.react('❓');

        // ✅ Sauvegarde pour /liste-event
        let events = [];
        if (fs.existsSync(dataFile)) {
            try { events = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch (e) {}
        }
        events.push({
            messageId: msg.id,
            channelId: msg.channelId,
            titre, date, heure, lieu, type
        });
        // Garder seulement les 20 derniers
        if (events.length > 20) events = events.slice(-20);
        fs.writeFileSync(dataFile, JSON.stringify(events, null, 2));
    }
};
