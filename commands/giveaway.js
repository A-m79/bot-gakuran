const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    AttachmentBuilder 
} = require('discord.js');
const path = require('path');
const Giveaway = require('../models/Giveaway');

const GIVEAWAY_CHANNEL_ID = '1530477010684743690';

// Convertisseur de temps (ex: "10m", "1h", "2d") en millisecondes
function parseDuration(str) {
    const match = str.match(/^(\d+)([smhd])$/i);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 's') return val * 1000;
    if (unit === 'm') return val * 60 * 1000;
    if (unit === 'h') return val * 3600 * 1000;
    if (unit === 'd') return val * 86400 * 1000;
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('🎉 Gestion des giveaways du gang')
        .addSubcommand(sub => sub
            .setName('start')
            .setDescription('Lancer un nouveau giveaway')
            .addStringOption(opt => opt.setName('duree').setDescription('Durée (ex: 10m, 1h, 2d)').setRequired(true))
            .addIntegerOption(opt => opt.setName('gagnants').setDescription('Nombre de gagnants').setRequired(true).setMinValue(1))
            .addStringOption(opt => opt.setName('lot').setDescription('Le lot à gagner').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('end')
            .setDescription('Terminer un giveaway en cours')
            .addStringOption(opt => opt.setName('message_id').setDescription('L\'ID du message du giveaway').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('reroll')
            .setDescription('Tirer au sort de nouveaux gagnants pour un giveaway terminé')
            .addStringOption(opt => opt.setName('message_id').setDescription('L\'ID du message du giveaway').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Vérification rôle admin
        const aLeGrade = interaction.member.roles.cache.some(r => (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim()).includes(r.id));
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à gérer les giveaways." });

        const sub = interaction.options.getSubcommand();

        // ─── 1. START ───
        if (sub === 'start') {
            const dureeStr = interaction.options.getString('duree');
            const winnersCount = interaction.options.getInteger('gagnants');
            const prize = interaction.options.getString('lot');

            const durationMs = parseDuration(dureeStr);
            if (!durationMs) return interaction.editReply({ content: '❌ Format de durée invalide. Utilisez `s` (secondes), `m` (minutes), `h` (heures) ou `d` (jours). Ex: `2h` ou `1d`.' });

            const channel = await interaction.client.channels.fetch(GIVEAWAY_CHANNEL_ID);
            if (!channel) return interaction.editReply({ content: '❌ Salon de giveaway introuvable.' });

            const endsAt = Date.now() + durationMs;
            const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });

            const embed = new EmbedBuilder()
                .setTitle(`🎉 GIVEAWAY : ${prize}`)
                .setDescription(`Cliquez sur le bouton ci-dessous pour participer !\n\n• **Lot :** ${prize}\n• **Nombre de gagnants :** \`${winnersCount}\`\n• **Fin :** <t:${Math.floor(endsAt / 1000)}:R> (<t:${Math.floor(endsAt / 1000)}:f>)\n• **Organisé par :** <@${interaction.user.id}>`)
                .setColor('#FF2A7A')
                .setThumbnail('attachment://logo.png')
                .setFooter({ text: '0 Participant(s) • Gurenkai' })
                .setTimestamp(endsAt);

            const btn = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_join')
                    .setLabel('🎉 Participer (0)')
                    .setStyle(ButtonStyle.Primary)
            );

            const msg = await channel.send({ embeds: [embed], components: [btn], files: [logo] });

            // Enregistrement dans MongoDB via Mongoose
            await Giveaway.create({
                messageId: msg.id,
                channelId: channel.id,
                prize,
                winnersCount,
                endsAt,
                ended: false,
                hostId: interaction.user.id,
                participants: []
            });

            // Programmer la fin automatique
            setTimeout(() => {
                module.exports.endGiveaway(interaction.client, msg.id);
            }, durationMs);

            return interaction.editReply({ content: `✅ Giveaway lancé dans <#${GIVEAWAY_CHANNEL_ID}> !` });
        }

        // ─── 2. END ───
        if (sub === 'end') {
            const messageId = interaction.options.getString('message_id');
            const gw = await Giveaway.findOne({ messageId });
            if (!gw) return interaction.editReply({ content: '❌ Giveaway introuvable avec cet ID de message.' });
            if (gw.ended) return interaction.editReply({ content: '⚠️ Ce giveaway est déjà terminé.' });

            await module.exports.endGiveaway(interaction.client, messageId);
            return interaction.editReply({ content: '✅ Giveaway terminé instantanément !' });
        }

        // ─── 3. REROLL ───
        if (sub === 'reroll') {
            const messageId = interaction.options.getString('message_id');
            const gw = await Giveaway.findOne({ messageId });
            if (!gw) return interaction.editReply({ content: '❌ Giveaway introuvable.' });
            if (!gw.participants || gw.participants.length === 0) return interaction.editReply({ content: '❌ Aucun participant à reroll.' });

            const channel = await interaction.client.channels.fetch(gw.channelId);
            const winners = [];
            const pool = [...gw.participants];

            for (let i = 0; i < Math.min(gw.winnersCount, pool.length); i++) {
                const randIndex = Math.floor(Math.random() * pool.length);
                winners.push(pool.splice(randIndex, 1)[0]);
            }

            const winnersMention = winners.map(id => `<@${id}>`).join(', ');
            await channel.send({ content: `🔄 **Nouveau tirage (Reroll) pour "${gw.prize}" !**\nFélicitations à : ${winnersMention} ! 🎉` });

            return interaction.editReply({ content: '✅ Relance effectué avec succès !' });
        }
    },

    // Fonction d'arrêt d'un giveaway
    async endGiveaway(client, messageId) {
        const gw = await Giveaway.findOne({ messageId });
        if (!gw || gw.ended) return;

        gw.ended = true;
        await gw.save();

        try {
            const channel = await client.channels.fetch(gw.channelId);
            const message = await channel.messages.fetch(gw.messageId);

            const winners = [];
            const pool = [...(gw.participants || [])];

            for (let i = 0; i < Math.min(gw.winnersCount, pool.length); i++) {
                const randIndex = Math.floor(Math.random() * pool.length);
                winners.push(pool.splice(randIndex, 1)[0]);
            }

            const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });

            const endEmbed = new EmbedBuilder()
                .setTitle(`🎉 GIVEAWAY TERMINÉ : ${gw.prize}`)
                .setColor('#2F3136')
                .setThumbnail('attachment://logo.png')
                .setDescription(`• **Lot :** ${gw.prize}\n• **Organisé par :** <@${gw.hostId}>\n• **Gagnant(s) :** ${winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'Aucun participant'}`)
                .setFooter({ text: `${gw.participants.length} Participant(s) • Gurenkai` })
                .setTimestamp();

            const disabledBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_ended')
                    .setLabel('🔒 Concours Terminé')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            await message.edit({ embeds: [endEmbed], components: [disabledBtn], files: [logo] });

            if (winners.length > 0) {
                await channel.send({ content: `🎉 **Félicitations ${winners.map(id => `<@${id}>`).join(', ')} !** Tu as remporté : **${gw.prize}** !` });
            } else {
                await channel.send({ content: `❌ Aucun participant n'a rejoint le giveaway pour **${gw.prize}**.` });
            }
        } catch (e) {
            console.error('[ERREUR END GIVEAWAY]', e);
        }
    }
};