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
                '# 💡 Besoin d\'assistance ?\n' +
                'Un problème en jeu, une question pour le Staff ou une réclamation ? Ne reste pas dans l\'ombre.\n\n' +
                '> 📌 **Clique sur le bouton ci-dessous** pour ouvrir un salon de discussion privé et sécurisé avec l\'équipe.\n\n' +
                '```ansi\n[31m🔴 Réservé aux membres sérieux du gang[0m\n```'
            )
            .setImage('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZydWludXV3ZzV4aGJ2MHR4bnhvbnlncG5ocWxybmd0amV1NHB3eiZlcD12MV9pbngrc2VhcmNoJmZzP2V0Xm5yY3Q9Zw/3ohhwytHcusSCXXOUg/giphy.gif')
            .setFooter({ text: 'Gurenkai Gang • Système de Tickets V2', iconURL: interaction.guild.iconURL({ dynamic: true }) });

        const button = new ButtonBuilder()
            .setCustomId('ticket_create')
            .setLabel('📩 Ouvrir un Ticket')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Panneau de tickets déployé avec succès !', ephemeral: true });
    }
};