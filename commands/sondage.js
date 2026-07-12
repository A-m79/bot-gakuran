const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');

const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sondage')
        .setDescription('📊 Créer un sondage officiel du gang')
        .addStringOption(opt => opt.setName('question').setDescription('Question posée').setRequired(true))
        .addStringOption(opt => opt.setName('option1').setDescription('Option 1').setRequired(true))
        .addStringOption(opt => opt.setName('option2').setDescription('Option 2').setRequired(true))
        .addStringOption(opt => opt.setName('option3').setDescription('Option 3 (optionnel)').setRequired(false))
        .addStringOption(opt => opt.setName('option4').setDescription('Option 4 (optionnel)').setRequired(false))
        .addStringOption(opt => opt.setName('option5').setDescription('Option 5 (optionnel)').setRequired(false))
        .addStringOption(opt => opt.setName('ping').setDescription('Rôle à mentionner (optionnel, ex: @everyone)').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        const aLeGrade = interaction.member.roles.cache.some(r => r.id === process.env.CHIEF_ROLE_ID);
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        const question = interaction.options.getString('question');
        const ping     = interaction.options.getString('ping') || '';
        const options  = [
            interaction.options.getString('option1'),
            interaction.options.getString('option2'),
            interaction.options.getString('option3'),
            interaction.options.getString('option4'),
            interaction.options.getString('option5'),
        ].filter(Boolean);

        const optionsText = options.map((opt, i) => `${EMOJIS[i]}  ${opt}`).join('\n\n');
        const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });

        const embed = new EmbedBuilder()
            .setTitle('📊 SONDAGE OFFICIEL')
            .setDescription(`**${question}**\n\n${optionsText}`)
            .setColor('#4A90D9')
            .setThumbnail('attachment://logo.png')
            .addFields(
                { name: '─'.repeat(30), value: '\u200B', inline: false },
                { name: '👮 Créé par', value: `${interaction.user} (${interaction.member.roles.highest.name})`, inline: true },
            )
            .setFooter({ text: 'Gakuran Gang • Votez en réagissant ci-dessous' })
            .setTimestamp();

        await interaction.editReply({
            content: ping ? `📊 **SONDAGE** — ${ping}` : '📊 **SONDAGE OFFICIEL**',
            embeds: [embed],
            files: [logo],
            allowedMentions: { parse: ['roles', 'everyone'] }
        });

        const msg = await interaction.fetchReply();
        for (let i = 0; i < options.length; i++) {
            await msg.react(EMOJIS[i]);
        }
    }
};
