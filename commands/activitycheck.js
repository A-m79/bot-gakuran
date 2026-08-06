const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const ActivityCheck = require('../models/ActivityCheck');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('activitycheck')
        .setDescription('📋 Gérer les activity checks du gang')
        .addSubcommand(sub => sub
            .setName('lancer')
            .setDescription('Lancer un nouvel activity check')
            .addIntegerOption(opt => opt.setName('objectif').setDescription('Nombre de réactions ✅ requis').setRequired(true).setMinValue(1))
            .addStringOption(opt => opt.setName('message').setDescription('Message personnalisé').setRequired(false))
        )
        .addSubcommand(sub => sub
            .setName('terminer')
            .setDescription('Terminer manuellement le check en cours')
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const aLeGrade = interaction.member.roles.cache.some(r => (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim()).includes(r.id));
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        const sub = interaction.options.getSubcommand();

        if (sub === 'lancer') {
            const objectif = interaction.options.getInteger('objectif');
            const messagePerso = interaction.options.getString('message') || 'Montrez votre présence et votre loyauté au sein du Gurenkai !';

            const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });

            const embed = new EmbedBuilder()
                .setTitle('📋 ACTIVITY CHECK — Gurenkai')
                .setDescription(`>>> ${messagePerso}`)
                .setColor('#FFD700')
                .setThumbnail('attachment://logo.png')
                .addFields(
                    { name: '─'.repeat(32), value: '\u200B', inline: false },
                    { name: '👇 Comment participer', value: 'Réagis avec ✅ ci-dessous pour confirmer ta présence.', inline: false },
                    { name: '🎯 Objectif', value: `**${objectif}** réactions`, inline: true },
                    { name: '📊 Statut', value: '⏳ En cours...', inline: true },
                )
                .setFooter({ text: 'Gurenkai • Activity Check' })
                .setTimestamp();

            // 🎯 Envoi dans le salon courant où la commande est exécutée
            const sentMsg = await interaction.channel.send({
                content: '@everyone',
                embeds: [embed],
                files: [logo],
                allowedMentions: { parse: ['everyone'] }
            });

            await sentMsg.react('✅');

            // Enregistrement dans MongoDB via Mongoose
            await ActivityCheck.create({
                messageId: sentMsg.id,
                channelId: sentMsg.channelId,
                objectif,
                reached: false
            });

            await interaction.editReply({ content: `✅ Activity check lancé dans <#${interaction.channelId}> — Objectif : **${objectif}** réactions.` });
        }

        if (sub === 'terminer') {
            const active = await ActivityCheck.findOne({ reached: false });
            if (!active) return interaction.editReply({ content: '❌ Aucun activity check en cours.' });

            try {
                const channel = await interaction.client.channels.fetch(active.channelId);
                const message = await channel.messages.fetch(active.messageId);

                // Récupération et calcul des réactions
                const reaction = message.reactions.cache.get('✅');
                let count = 0;
                if (reaction) {
                    // On retire 1 si le bot a lui-même réagi au départ
                    count = reaction.me ? reaction.count - 1 : reaction.count;
                }

                // 1. Modification visuelle de l'embed d'origine
                const oldEmbed = message.embeds[0];
                if (oldEmbed) {
                    const finishedEmbed = EmbedBuilder.from(oldEmbed)
                        .setColor('#00FF00') // Passe au vert
                        .setFields(
                            { name: '─'.repeat(32), value: '\u200B', inline: false },
                            { name: '👇 Comment participer', value: '~~Réagis avec ✅ ci-dessous pour confirmer ta présence.~~ (Terminé)', inline: false },
                            { name: '🎯 Objectif', value: `**${active.objectif}** réactions (Atteint : **${count}** ✅)`, inline: true },
                            { name: '📊 Statut', value: '✅ **Terminé !**', inline: true }
                        );

                    await message.edit({ embeds: [finishedEmbed] });
                }

                // 2. Message de félicitations dans le salon
                await channel.send({
                    content: `🎉 **L'activity check est désormais terminé !**\nMerci aux **${count}** membres actifs d'avoir répondu présent. ⛩️🔥`
                });

                // 3. Clôture dans la base de données MongoDB
                active.reached = true;
                await active.save();

                await interaction.editReply({ content: `✅ Activity check clôturé avec succès ! (**${count}** réactions enregistrées).` });

            } catch (error) {
                console.error('[ERREUR CLÔTURE MANUELLE]', error);
                
                // Si le message d'origine a été supprimé, on ferme quand même dans la DB pour ne pas bloquer le bot
                active.reached = true;
                await active.save();
                
                await interaction.editReply({ content: "⚠️ Impossible de modifier le message d'origine (supprimé ?), mais l'activity check a bien été désactivé dans la base de données." });
            }
        }
    }
};