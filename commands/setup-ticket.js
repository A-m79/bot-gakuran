const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-ticket')
        .setDescription('⚙️ Envoie le panneau de tickets ultra stylé (Réservé Staff)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('⛩️ GURENKAI — CENTRE DE SUPPORT & TICKETS')
            .setColor('#FF2A7A')
            .setDescription(
                '# 💡 Une question, un report ou une suggestion ?\n' +
                'Un problème en jeu, une réclamation ou une idée à partager avec le gang ? N\'hésite pas à nous en faire part.\n\n' +
                '> 📌 **Clique sur le bouton ci-dessous** pour ouvrir un salon de discussion privé et sécurisé avec l\'équipe.\n\n' +
                '```ansi\n[31m⚠️ Tout ticket ouvert pour troll ou abus entraînera une sanction.\n```'
            )
            .setImage('https://media1.giphy.com/media/uZZVUsUSWxtdpeQoMC/giphy.gif')
            .setFooter({ text: 'Gurenkai Gang • Système de Tickets', iconURL: interaction.guild.iconURL({ dynamic: true }) });

        const button = new ButtonBuilder()
            .setCustomId('ticket_create')
            .setLabel('📩 Ouvrir un Ticket')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Panneau de tickets déployé avec succès !', ephemeral: true });
    }
};