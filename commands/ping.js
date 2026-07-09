const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('🏓 Vérifier la latence du bot'),

    async execute(interaction) {
        await interaction.deferReply();

        const latency    = Date.now() - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        const color = latency < 100 ? '#00FF88' : latency < 300 ? '#FFD700' : '#FF4444';

        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong !')
            .setColor(color)
            .addFields(
                { name: '⚡ Latence bot', value: `**${latency}ms**`, inline: true },
                { name: '🌐 Latence API', value: `**${apiLatency}ms**`, inline: true },
            )
            .setFooter({ text: 'Gakuran Gang' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
