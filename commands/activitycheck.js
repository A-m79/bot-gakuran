const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '..', 'data', 'activitycheck.json');

function loadChecks() {
    if (!fs.existsSync(dataFile)) return [];
    try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch (e) { return []; }
}

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
            const objectif    = interaction.options.getInteger('objectif');
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

            const checkChannel = await interaction.client.channels.fetch(process.env.ACTIVITY_CHECK_CHANNEL_ID);
            const sentMsg = await checkChannel.send({
                content: '@everyone',
                embeds: [embed],
                files: [logo],
                allowedMentions: { parse: ['everyone'] }
            });

            await sentMsg.react('✅');

            let checks = loadChecks().filter(c => c.reached);
            checks.push({ messageId: sentMsg.id, channelId: sentMsg.channelId, objectif, reached: false });
            fs.writeFileSync(dataFile, JSON.stringify(checks, null, 2));

            await interaction.editReply({ content: `✅ Activity check lancé dans <#${process.env.ACTIVITY_CHECK_CHANNEL_ID}> — Objectif : **${objectif}** réactions.` });
        }

        if (sub === 'terminer') {
            const checks = loadChecks();
            const active = checks.find(c => !c.reached);
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

                // 3. Clôture dans le fichier JSON
                active.reached = true;
                fs.writeFileSync(dataFile, JSON.stringify(checks, null, 2));

                await interaction.editReply({ content: `✅ Activity check clôturé avec succès ! (**${count}** réactions enregistrées).` });

            } catch (error) {
                console.error('[ERREUR CLÔTURE MANUELLE]', error);
                
                // Si le message d'origine a été supprimé, on ferme quand même dans la DB pour ne pas bloquer le bot
                active.reached = true;
                fs.writeFileSync(dataFile, JSON.stringify(checks, null, 2));
                
                await interaction.editReply({ content: "⚠️ Impossible de modifier le message d'origine (supprimé ?), mais l'activity check a bien été désactivé dans la base de données." });
            }
        }
    }
};