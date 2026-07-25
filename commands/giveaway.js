const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    AttachmentBuilder 
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const Giveaway = require('../models/Giveaway');

const GIVEAWAY_CHANNEL_ID = '1530477010684743690';

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

const giveawayModule = {
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

        const aLeGrade = interaction.member.roles.cache.some(r => (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim()).includes(r.id));
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à gérer les giveaways." });

        const sub = interaction.options.getSubcommand();

        if (sub === 'start') {
            const dureeStr = interaction.options.getString('duree');
            const winnersCount = interaction.options.getInteger('gagnants');
            const prize = interaction.options.getString('lot');

            const durationMs = parseDuration(dureeStr);
            if (!durationMs) return interaction.editReply({ content: '❌ Format de durée invalide. Utilisez `s`, `m`, `h` ou `d`.' });

            const channel = await interaction.client.channels.fetch(GIVEAWAY_CHANNEL_ID);
            if (!channel) return interaction.editReply({ content: '❌ Salon de giveaway introuvable.' });

            const endsAt = Date.now() + durationMs;
            const logoPath = path.join(__dirname, '..', 'logo.png');
            const logo = fs.existsSync(logoPath) ? new AttachmentBuilder(logoPath, { name: 'logo.png' }) : null;

            const embed = new EmbedBuilder()
                .setTitle(`🎉 GIVEAWAY : ${prize}`)
                .setDescription(`Cliquez sur le bouton ci-dessous pour participer !\n\n• **Lot :** ${prize}\n• **Nombre de gagnants :** \`${winnersCount}\`\n• **Fin :** <t:${Math.floor(endsAt / 1000)}:R> (<t:${Math.floor(endsAt / 1000)}:f>)\n• **Organisé par :** <@${interaction.user.id}>`)
                .setColor('#FF2A7A')
                .setFooter({ text: '0 Participant(s) • Gurenkai' })
                .setTimestamp(endsAt);

            if (logo) embed.setThumbnail('attachment://logo.png');

            const btn = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_join')
                    .setLabel('🎉 Participer (0)')
                    .setStyle(ButtonStyle.Primary)
            );

            const msgPayload = { embeds: [embed], components: [btn] };
            if (logo) msgPayload.files = [logo];

            const msg = await channel.send(msgPayload);

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

            const timeLeft = endsAt - Date.now();
            setTimeout(() => {
                giveawayModule.endGiveaway(interaction.client, msg.id);
            }, timeLeft);

            return interaction.editReply({ content: `✅ Giveaway lancé dans <#${GIVEAWAY_CHANNEL_ID}> !` });
        }

        if (sub === 'end') {
            const messageId = interaction.options.getString('message_id');
            const gw = await Giveaway.findOne({ messageId });
            if (!gw) return interaction.editReply({ content: '❌ Giveaway introuvable.' });
            if (gw.ended) return interaction.editReply({ content: '⚠️ Ce giveaway est déjà terminé.' });

            await giveawayModule.endGiveaway(interaction.client, messageId);
            return interaction.editReply({ content: '✅ Giveaway terminé instantanément !' });
        }

        if (sub === 'reroll') {
            const messageId = interaction.options.getString('message_id');
            const gw = await Giveaway.findOne({ messageId });
            if (!gw) return interaction.editReply({ content: '❌ Giveaway introuvable.' });
            if (!gw.participants || gw.participants.length < 2) return interaction.editReply({ content: '❌ Il faut au moins 2 participants pour effectuer un reroll.' });

            const channel = await interaction.client.channels.fetch(gw.channelId);
            const winners = [];
            const pool = [...gw.participants];

            for (let i = 0; i < Math.min(gw.winnersCount, pool.length); i++) {
                const randIndex = Math.floor(Math.random() * pool.length);
                winners.push(pool.splice(randIndex, 1)[0]);
            }

            const winnersMention = winners.map(id => `<@${id}>`).join(', ');
            await channel.send({ content: `🔄 **Nouveau tirage (Reroll) pour "${gw.prize}" !**\nFélicitations à : ${winnersMention} ! 🎉` });

            return interaction.editReply({ content: '✅ Relance effectuée avec succès !' });
        }
    },

    async handleButton(interaction) {
        if (interaction.customId === 'giveaway_join') {
            const gw = await Giveaway.findOne({ messageId: interaction.message.id });
            if (!gw || gw.ended) {
                return interaction.reply({ content: '❌ Ce giveaway est terminé !', ephemeral: true });
            }

            const userId = interaction.user.id;
            const participants = (gw.participants || []).map(id => String(id));
            const isParticipating = participants.includes(userId);

            if (isParticipating) {
                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`gw_leave_confirm_${interaction.message.id}`)
                        .setLabel('Oui, quitter le giveaway')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('gw_leave_cancel')
                        .setLabel('Annuler')
                        .setStyle(ButtonStyle.Secondary)
                );

                return interaction.reply({
                    content: '⚠️ Tu participes déjà à ce giveaway. Es-tu sûr de vouloir **quitter** ?',
                    components: [confirmRow],
                    ephemeral: true
                });
            }

            const updatedGw = await Giveaway.findOneAndUpdate(
                { messageId: interaction.message.id },
                { $addToSet: { participants: userId } },
                { new: true }
            );

            const count = updatedGw.participants.length;

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFooter({ text: `${count} Participant(s) • Gurenkai` });

            const updatedBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_join')
                    .setLabel(`🎉 Participer (${count})`)
                    .setStyle(ButtonStyle.Primary)
            );

            const logoPath = path.join(__dirname, '..', 'logo.png');
            const files = fs.existsSync(logoPath) ? [new AttachmentBuilder(logoPath, { name: 'logo.png' })] : [];

            await interaction.message.edit({ embeds: [updatedEmbed], components: [updatedBtn], files });

            return interaction.reply({ content: '🎉 Ta participation au giveaway a bien été enregistrée ! Good luck !', ephemeral: true });
        }

        if (interaction.customId && interaction.customId.startsWith('gw_leave_confirm_')) {
            const messageId = interaction.customId.replace('gw_leave_confirm_', '');
            const gw = await Giveaway.findOne({ messageId });
            
            if (!gw || gw.ended) {
                return interaction.update({ content: '❌ Ce giveaway est terminé ou introuvable.', components: [] });
            }

            const userId = interaction.user.id;

            const updatedGw = await Giveaway.findOneAndUpdate(
                { messageId },
                { $pull: { participants: userId } },
                { new: true }
            );

            const count = updatedGw.participants.length;

            try {
                const channel = await interaction.client.channels.fetch(gw.channelId);
                const message = await channel.messages.fetch(messageId);

                const updatedEmbed = EmbedBuilder.from(message.embeds[0])
                    .setFooter({ text: `${count} Participant(s) • Gurenkai` });

                const updatedBtn = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('giveaway_join')
                        .setLabel(`🎉 Participer (${count})`)
                        .setStyle(ButtonStyle.Primary)
                );

                const logoPath = path.join(__dirname, '..', 'logo.png');
                const files = fs.existsSync(logoPath) ? [new AttachmentBuilder(logoPath, { name: 'logo.png' })] : [];

                await message.edit({ embeds: [updatedEmbed], components: [updatedBtn], files });
            } catch (e) {
                console.error('[ERREUR UPDATE MESSAGE GIVEAWAY LEAVE]', e);
            }

            return interaction.update({ content: '❌ Tu as bien quitté le giveaway.', components: [] });
        }

        if (interaction.customId === 'gw_leave_cancel') {
            return interaction.update({ content: '👍 Action annulée, tu restes inscrit au giveaway !', components: [] });
        }
    },

    async endGiveaway(client, messageId) {
        const gw = await Giveaway.findOneAndUpdate(
            { messageId, ended: false },
            { $set: { ended: true } },
            { new: true }
        );

        if (!gw) return;

        try {
            const channel = await client.channels.fetch(gw.channelId);
            const message = await channel.messages.fetch(gw.messageId);
            const logoPath = path.join(__dirname, '..', 'logo.png');
            const logo = fs.existsSync(logoPath) ? new AttachmentBuilder(logoPath, { name: 'logo.png' }) : null;

            if (!gw.participants || gw.participants.length < 2) {
                const cancelledEmbed = new EmbedBuilder()
                    .setTitle(`❌ GIVEAWAY ANNULÉ : ${gw.prize}`)
                    .setColor('#ED4245')
                    .setDescription(`• **Lot :** ${gw.prize}\n• **Organisé par :** <@${gw.hostId}>\n• **Statut :** Annulé (Moins de 2 participants)`)
                    .setFooter({ text: `${gw.participants ? gw.participants.length : 0} Participant(s) • Gurenkai` })
                    .setTimestamp();

                if (logo) cancelledEmbed.setThumbnail('attachment://logo.png');

                const disabledBtn = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('giveaway_cancelled')
                        .setLabel('❌ Concours Annulé')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

                const editPayload = { embeds: [cancelledEmbed], components: [disabledBtn] };
                if (logo) editPayload.files = [logo];

                await message.edit(editPayload);
                await channel.send({ content: `❌ Le giveaway pour **${gw.prize}** a été annulé faute de participants (moins de 2 participants).` });
                return;
            }

            const winners = [];
            const pool = [...gw.participants];

            for (let i = 0; i < Math.min(gw.winnersCount, pool.length); i++) {
                const randIndex = Math.floor(Math.random() * pool.length);
                winners.push(pool.splice(randIndex, 1)[0]);
            }

            const endEmbed = new EmbedBuilder()
                .setTitle(`🎉 GIVEAWAY TERMINÉ : ${gw.prize}`)
                .setColor('#2F3136')
                .setDescription(`• **Lot :** ${gw.prize}\n• **Organisé par :** <@${gw.hostId}>\n• **Gagnant(s) :** ${winners.map(id => `<@${id}>`).join(', ')}`)
                .setFooter({ text: `${gw.participants.length} Participant(s) • Gurenkai` })
                .setTimestamp();

            if (logo) endEmbed.setThumbnail('attachment://logo.png');

            const disabledBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_ended')
                    .setLabel('🔒 Concours Terminé')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            const editPayload = { embeds: [endEmbed], components: [disabledBtn] };
            if (logo) editPayload.files = [logo];

            await message.edit(editPayload);

            if (winners.length > 0) {
                await channel.send({ content: `🎉 **Félicitations ${winners.map(id => `<@${id}>`).join(', ')} !** Tu as remporté : **${gw.prize}** !` });
            }
        } catch (e) {
            console.error('[ERREUR END GIVEAWAY]', e);
        }
    },

    async checkOngoingGiveaways(client) {
        try {
            const activeGiveaways = await Giveaway.find({ ended: false });
            const now = Date.now();

            for (const gw of activeGiveaways) {
                const timeLeft = gw.endsAt - now;
                if (timeLeft <= 0) {
                    await giveawayModule.endGiveaway(client, gw.messageId);
                } else {
                    setTimeout(() => {
                        giveawayModule.endGiveaway(client, gw.messageId);
                    }, timeLeft);
                }
            }
        } catch (e) {
            console.error('[ERREUR CHECK GIVEAWAYS]', e);
        }
    }
};

module.exports = giveawayModule;