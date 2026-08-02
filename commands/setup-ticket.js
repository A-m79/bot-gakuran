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
                'N\'hésite pas à nous en faire part.\n\n' +
                '> 📌 **Afin d\'ouvrir un ticket, clique sur le bouton ci-dessous.**\n\n' +
                '```ansi\n[31m⚠️ Tout ticket ouvert pour troll ou abus entraînera une sanction.\n```'
            )
            .setImage('https://cdn.discordapp.com/attachments/1525294245236445226/1533574234406781138/8eab73c05066210554068a5cd4d5fea9.gif?ex=6a70fbcd&is=6a6faa4d&hm=edf5c9c7b50b95596b166e277cfb779b18db9f8876cf50886b52edc4f3b32d38&')
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