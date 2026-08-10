const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ReactionRole = require('../models/ReactionRole');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionrole-create')
        .setDescription('🎭 Crée un message de rôles-réactions stylé')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption(option =>
            option.setName('titre')
                .setDescription('Titre de l\'embed')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Texte descriptif (utilise \\n pour les retours à la ligne)')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('salon')
                .setDescription('Salon où poster le message')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('couleur')
                .setDescription('Couleur de l\'embed. Par défaut rose Gurenkai')
                .setRequired(false)
                .addChoices(
                    { name: '🩷 Rose Gurenkai', value: '#FF2A7A' },
                    { name: '🔴 Rouge', value: '#ED4245' },
                    { name: '🟠 Orange', value: '#E67E22' },
                    { name: '🟡 Jaune', value: '#F1C40F' },
                    { name: '🟢 Vert', value: '#57F287' },
                    { name: '🔵 Bleu', value: '#3498DB' },
                    { name: '🟣 Violet', value: '#9B59B6' },
                    { name: '⚫ Noir', value: '#23272A' },
                    { name: '⚪ Blanc', value: '#FFFFFF' },
                    { name: '🩵 Cyan', value: '#00D9FF' },
                    { name: '💛 Or', value: '#FFD700' },
                    { name: '🟤 Marron', value: '#8B4513' },
                ))
        .addStringOption(option =>
            option.setName('image')
                .setDescription('URL d\'une image à afficher en bas de l\'embed')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('miniature')
                .setDescription('URL d\'une miniature (icône en haut à droite)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('exclusif')
                .setDescription('Un seul rôle à la fois parmi ceux de ce message (par défaut: non)')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const titre = interaction.options.getString('titre');
        const description = interaction.options.getString('description').replace(/\\n/g, '\n');
        const salon = interaction.options.getChannel('salon');
        const couleur = interaction.options.getString('couleur') || '#FF2A7A';
        const image = interaction.options.getString('image');
        const miniature = interaction.options.getString('miniature');
        const exclusif = interaction.options.getBoolean('exclusif') || false;

        if (!salon.isTextBased()) {
            return interaction.editReply({ content: '❌ Le salon choisi doit être un salon textuel.' });
        }

        if (couleur && !/^#[0-9A-F]{6}$/i.test(couleur)) {
            return interaction.editReply({ content: '❌ Couleur invalide. Utilise un format hex comme `#FF2A7A`.' });
        }

        const embed = new EmbedBuilder()
            .setTitle(titre)
            .setDescription(description)
            .setColor(couleur)
            .setFooter({ text: 'Gurenkai • Rôles par réaction' })
            .setTimestamp();

        if (image?.startsWith('http')) embed.setImage(image);
        if (miniature?.startsWith('http')) embed.setThumbnail(miniature);

        try {
            const sentMessage = await salon.send({ embeds: [embed] });

            await ReactionRole.create({
                messageId: sentMessage.id,
                channelId: salon.id,
                guildId: interaction.guild.id,
                exclusive: exclusif,
                bindings: []
            });

            return interaction.editReply({
                content: `✅ Message créé dans ${salon} !\n\n` +
                    `**Pour associer des rôles :** réagis directement sur le message ci-dessus avec l'emoji de ton choix (clique sur l'icône réaction du message, comme sur n'importe quel message Discord). Tu recevras ensuite un MP pour choisir le rôle à associer.\n\n` +
                    `Répète l'opération pour chaque emoji que tu veux ajouter.\n` +
                    (exclusif ? `\n⚠️ Mode **exclusif** activé : un membre ne pourra avoir qu'un seul rôle à la fois parmi ceux de ce message.` : '')
            });

        } catch (err) {
            console.error('❌ Erreur création reaction role :', err);
            return interaction.editReply({ content: '❌ Impossible de créer le message (vérifie les permissions du bot dans ce salon).' });
        }
    }
};