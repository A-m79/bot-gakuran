const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const Giveaway = require('../models/Giveaway');
const DisabledCommand = require('../models/DisabledCommand');
const { handleAddButton, handleEmojiModal, handleRoleSelect } = require('../handlers/reactionRoleFlow');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {

        // ─── SÉCURITÉ : Ignorer le menu déroulant du /help ───
        if (interaction.isStringSelectMenu() && interaction.customId === 'help_category_select') return;

        // ─── 1. COMMANDES SLASH ───
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            // 🔒 VÉRIFICATION DES COMMANDES DÉSACTIVÉES (Via MongoDB)
            try {
                const isDisabled = await DisabledCommand.exists({ commandName: interaction.commandName });
                if (isDisabled) {
                    return interaction.reply({ 
                        content: `❌ La commande **/${interaction.commandName}** est actuellement désactivée par la direction.`, 
                        ephemeral: true 
                    });
                }
            } catch (err) {
                console.error('Erreur vérification MongoDB commandes désactivées:', err);
            }

            try {
                await command.execute(interaction);

                // System Logs
                const logChannelId = process.env.LOGS_CHANNEL_ID?.trim();
                if (logChannelId) {
                    const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
                    if (logChannel) {
                        let optsText = '';
                        interaction.options.data.forEach(opt => {
                            if (opt.options) {
                                opt.options.forEach(sub => { optsText += `• **${sub.name}** : ${sub.value}\n`; });
                            } else {
                                optsText += `• **${opt.name}** : ${opt.value}\n`;
                            }
                        });

                        const logEmbed = new EmbedBuilder()
                            .setTitle('📥 Log de Commande — Gurenkai V2')
                            .setColor('#FFD700')
                            .setDescription(`**${interaction.user.tag}** a exécuté une commande.`)
                            .addFields(
                                { name: '👤 Utilisateur', value: `<@${interaction.user.id}>`, inline: true },
                                { name: '💻 Commande', value: `\`/${interaction.commandName}\``, inline: true },
                                { name: '📍 Salon', value: `<#${interaction.channelId}>`, inline: true },
                                { name: '📋 Données', value: optsText || '_Aucune option_', inline: false }
                            )
                            .setTimestamp();

                        await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
                    }
                }
            } catch (error) {
                console.error(`❌ Erreur /${interaction.commandName} :`, error);
                const msg = { content: '❌ Une erreur est survenue lors de l\'exécution.', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(msg);
                } else {
                    await interaction.reply(msg);
                }
            }
            return;
        }

        // ─── 2. BOUTONS ───
        if (interaction.isButton()) {

            // 🔓 DÉBANNIR UN MODÉRATEUR / BOT / MEMBRE (unban_ & antinuke_unban_)
            if (interaction.customId.startsWith('antinuke_unban_') || interaction.customId.startsWith('unban_')) {
                if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: "❌ Vous n'avez pas la permission de débannir !", ephemeral: true });
                }

                await interaction.deferReply({ ephemeral: true }).catch(() => null);

                const userIdToUnban = interaction.customId.includes('antinuke_unban_') 
                    ? interaction.customId.replace('antinuke_unban_', '')
                    : interaction.customId.replace('unban_', '');

                try {
                    await interaction.guild.members.unban(userIdToUnban, `Débannissement via bouton par ${interaction.user.tag}`);

                    if (interaction.message?.components?.length > 0) {
                        const updatedRows = interaction.message.components.map(row => {
                            const newRow = new ActionRowBuilder();
                            row.components.forEach(comp => {
                                const btn = ButtonBuilder.from(comp);
                                if (comp.customId === interaction.customId) {
                                    btn.setDisabled(true).setLabel('✅ Utilisateur Débanni').setStyle(ButtonStyle.Secondary);
                                }
                                newRow.addComponents(btn);
                            });
                            return newRow;
                        });
                        await interaction.message.edit({ components: updatedRows }).catch(() => null);
                    }

                    await interaction.editReply({ content: `✅ L'utilisateur/bot (<@${userIdToUnban}>) a été débanni avec succès !` });
                } catch (err) {
                    console.error("Erreur unban :", err);
                    await interaction.editReply({ content: "❌ Impossible de débannir cet utilisateur (ID introuvable ou déjà débanni)." });
                }
                return;
            }

            // 🔗 GÉNÉRER UNE INVITATION DE RÉINTÉGRATION (reinvite_)
            if (interaction.customId.startsWith('reinvite_')) {
                if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: "❌ Vous n'avez pas les permissions requises pour exécuter cette action.", ephemeral: true });
                }

                await interaction.deferReply({ ephemeral: true }).catch(() => null);

                const targetId = interaction.customId.replace('reinvite_', '');

                try {
                    await interaction.guild.members.unban(targetId, 'Débannissement automatique pour réinvitation').catch(() => null);

                    const targetUser = await client.users.fetch(targetId).catch(() => null);
                    if (!targetUser) {
                        return await interaction.editReply({ content: '❌ Impossible de trouver cet utilisateur Discord.' });
                    }

                    const invite = await interaction.channel.createInvite({
                        maxAge: 86400,
                        maxUses: 1,
                        unique: true,
                        reason: `Lien de réintégration généré par ${interaction.user.tag}`
                    }).catch(() => null);

                    if (!invite) {
                        return await interaction.editReply({ content: '❌ Impossible de créer une invitation dans ce salon (vérifiez les permissions du bot).' });
                    }

                    if (interaction.message?.components?.length > 0) {
                        const updatedRows = interaction.message.components.map(row => {
                            const newRow = new ActionRowBuilder();
                            row.components.forEach(comp => {
                                const btn = ButtonBuilder.from(comp);
                                if (comp.customId === interaction.customId) {
                                    btn.setDisabled(true).setLabel('✅ Invitation Générée').setStyle(ButtonStyle.Secondary);
                                }
                                newRow.addComponents(btn);
                            });
                            return newRow;
                        });
                        await interaction.message.edit({ components: updatedRows }).catch(() => null);
                    }

                    await targetUser.send(`Bonjour ! Voici un lien unique pour réintégrer le serveur **${interaction.guild.name}** : ${invite.url}`).catch(() => null);

                    await interaction.editReply({ 
                        content: `🔗 **Lien d'invitation généré pour <@${targetUser.id}> !**\n\nVoici le lien unique (valable 24h / 1 utilisation) à lui transmettre :\n👉 **${invite.url}**` 
                    });

                } catch (err) {
                    console.error('Erreur réinvitation :', err);
                    await interaction.editReply({ content: '❌ Une erreur est survenue lors du traitement de la réinvitation.' });
                }
                return;
            }

            // 🛡️ DÉTECTEUR D'ALT ROBLOX (/rblx-info)
            if (interaction.customId.startsWith('rblx_alt_') || interaction.customId.startsWith('rblx_compare_')) {
                const command = client.commands.get('rblx-info');
                if (command && command.handleButton) {
                    return await command.handleButton(interaction);
                }
            }

            // 🎭 REACTION ROLE : bouton "➕ Ajouter une réaction"
            if (interaction.customId.startsWith('rr_add_')) {
                return await handleAddButton(interaction);
            }

            // 📩 CRÉATION DE TICKET
            if (interaction.customId === 'ticket_create') {
                await interaction.deferReply({ ephemeral: true });
                const guild = interaction.guild;
                const member = interaction.member;

                const existingTicket = guild.channels.cache.find(c => c.name === `ticket-${member.user.username.toLowerCase()}`);
                if (existingTicket) {
                    return interaction.editReply({ content: `❌ Tu as déjà un ticket ouvert dans ${existingTicket} !` });
                }

                try {
                    const ticketChannel = await guild.channels.create({
                        name: `ticket-${member.user.username}`,
                        type: ChannelType.GuildText,
                        parent: '1536318330145611827',
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone.id,
                                deny: [PermissionFlagsBits.ViewChannel],
                            },
                            {
                                id: member.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory],
                            },
                            {
                                id: client.user.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
                            },
                        ],
                    });

                    const embedWelcome = new EmbedBuilder()
                        .setTitle(`🎫 Ticket de ${member.displayName}`)
                        .setColor('#FF2A7A')
                        .setDescription('Bienvenue dans ton ticket !\nExplique ton problème ci-dessous, un membre du Staff va bientôt te prendre en charge.')
                        .setTimestamp();

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_claim')
                            .setLabel('🙋‍♂️ Claim le Ticket')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('ticket_close')
                            .setLabel('🔒 Fermer')
                            .setStyle(ButtonStyle.Danger)
                    );

                    await ticketChannel.send({ content: `${member} | Staff`, embeds: [embedWelcome], components: [row] });
                    await interaction.editReply({ content: `✅ Ticket créé avec succès : ${ticketChannel}` });
                } catch (err) {
                    console.error('❌ Erreur création ticket :', err);
                    await interaction.editReply({ content: '❌ Impossible de créer le ticket.' });
                }
                return;
            }

            // 🙋‍♂️ CLAIM LE TICKET (Réservé Staff)
            if (interaction.customId === 'ticket_claim') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Seul le Staff peut claim un ticket.', ephemeral: true });
                }

                const oldRow = interaction.message.components[0];
                const newRow = new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(oldRow.components[0]).setDisabled(true).setLabel(`Pris par ${interaction.member.displayName}`),
                    ButtonBuilder.from(oldRow.components[1])
                );

                await interaction.update({ components: [newRow] });
                await interaction.channel.send({ content: `> 🛡️ Ce ticket a été pris en charge par **${interaction.user}**. Il s'occupera de toi !` });
                return;
            }

            // 🔒 FERMETURE DE TICKET + TRANSCRIPT MP
            if (interaction.customId === 'ticket_close') {
                await interaction.reply({ content: '🔒 Génération du transcript et fermeture du ticket dans 5 secondes...' });

                try {
                    const messages = await interaction.channel.messages.fetch({ limit: 100 });
                    const sortedMessages = Array.from(messages.values()).reverse();
                    
                    let transcriptText = `--- TRANSCRIPT DU TICKET : ${interaction.channel.name} ---\n`;
                    sortedMessages.forEach(m => {
                        const time = new Date(m.createdTimestamp).toLocaleString();
                        transcriptText += `[${time}] ${m.author.tag}: ${m.content}\n`;
                    });

                    const buffer = Buffer.from(transcriptText, 'utf-8');
                    const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });

                    let targetMember = null;
                    for (const [id, overwrite] of interaction.channel.permissionOverwrites.cache) {
                        if (id !== interaction.guild.id && id !== client.user.id) {
                            const member = await interaction.guild.members.fetch(id).catch(() => null);
                            if (member && !member.user.bot) {
                                targetMember = member;
                                break;
                            }
                        }
                    }

                    if (targetMember) {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle('📜 Transcript de ton Ticket — Gurenkai')
                            .setColor('#FF2A7A')
                            .setDescription('Voici ci-joint le récapitulatif textuel de ton ticket qui vient d\'être fermé.')
                            .setTimestamp();

                        await targetMember.send({ embeds: [dmEmbed], files: [attachment] }).catch(() => null);
                    }
                } catch (err) {
                    console.error('❌ Erreur génération transcript :', err);
                }

                setTimeout(async () => {
                    await interaction.channel.delete().catch(() => null);
                }, 5000);
                return;
            }

            // Fiche Info Modal Trigger
            if (interaction.customId === 'ouvrir_fiche_modal') {
                const modal = new ModalBuilder()
                    .setCustomId('soumettre_fiche_modal')
                    .setTitle('📝 Votre Fiche Gurenkai (IG)');

                const nomInput = new TextInputBuilder()
                    .setCustomId('fiche_nom')
                    .setLabel('Nom & Prénom (En Jeu)')
                    .setPlaceholder('Ex: Kenji Sato')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const styleInput = new TextInputBuilder()
                    .setCustomId('fiche_style')
                    .setLabel('Style de combat & autres infos')
                    .setPlaceholder('Décrivez votre style ou rôle')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const telInput = new TextInputBuilder()
                    .setCustomId('fiche_tel')
                    .setLabel('Numéro de téléphone (En Jeu)')
                    .setPlaceholder('Ex: 555-0192')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const photoInput = new TextInputBuilder()
                    .setCustomId('fiche_photo')
                    .setLabel('Photo (Lien d\'image)')
                    .setPlaceholder('Collez un lien d\'image')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nomInput),
                    new ActionRowBuilder().addComponents(styleInput),
                    new ActionRowBuilder().addComponents(telInput),
                    new ActionRowBuilder().addComponents(photoInput)
                );

                await interaction.showModal(modal);
                return;
            }

            // Inscription Giveaway (MongoDB)
            if (interaction.customId === 'giveaway_join') {
                const gw = await Giveaway.findOne({ messageId: interaction.message.id });
                if (!gw || gw.ended) {
                    return interaction.reply({ content: '❌ Ce giveaway est terminé !', ephemeral: true });
                }

                const userId = interaction.user.id;
                const index = gw.participants.indexOf(userId);

                if (index > -1) {
                    gw.participants.splice(index, 1);
                    await gw.save();

                    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setFooter({ text: `${gw.participants.length} Participant(s) • Gurenkai` });

                    const updatedBtn = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('giveaway_join')
                            .setLabel(`🎉 Participer (${gw.participants.length})`)
                            .setStyle(ButtonStyle.Primary)
                    );

                    await interaction.message.edit({ embeds: [updatedEmbed], components: [updatedBtn] });
                    return interaction.reply({ content: '❌ Ta participation au giveaway a été retirée.', ephemeral: true });
                } else {
                    gw.participants.push(userId);
                    await gw.save();

                    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setFooter({ text: `${gw.participants.length} Participant(s) • Gurenkai` });

                    const updatedBtn = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('giveaway_join')
                            .setLabel(`🎉 Participer (${gw.participants.length})`)
                            .setStyle(ButtonStyle.Primary)
                    );

                    await interaction.message.edit({ embeds: [updatedEmbed], components: [updatedBtn] });
                    return interaction.reply({ content: '🎉 Ta participation au giveaway a bien été enregistrée ! Good luck !', ephemeral: true });
                }
            }
            return;
        }

        // ─── 3. MENUS DÉROULANTS (SELECT MENUS) ───
        if (interaction.isRoleSelectMenu()) {
            // 🎭 REACTION ROLE : sélection du rôle à associer
            if (interaction.customId.startsWith('rr_roleselect_')) {
                return await handleRoleSelect(interaction);
            }
            return;
        }

        // ─── 4. MODALS (FORMULAIRES) ───
        if (interaction.isModalSubmit()) {

            // 🎭 REACTION ROLE : soumission de l'emoji
            if (interaction.customId.startsWith('rr_emoji_modal_')) {
                return await handleEmojiModal(interaction);
            }

            if (interaction.customId === 'soumettre_fiche_modal') {
                const nom = interaction.fields.getTextInputValue('fiche_nom');
                const style = interaction.fields.getTextInputValue('fiche_style');
                const tel = interaction.fields.getTextInputValue('fiche_tel');
                const photo = interaction.fields.getTextInputValue('fiche_photo') || '';

                const destChannelId = process.env.FICHE_CHANNEL_ID || '1526596000314294453';
                const destChannel = interaction.guild.channels.cache.get(destChannelId);

                if (!destChannel) {
                    return interaction.reply({ content: "❌ Impossible de trouver le salon des fiches.", ephemeral: true });
                }

                const embedFiche = new EmbedBuilder()
                    .setTitle(`👤 FICHE D'IDENTITÉ — ${nom.toUpperCase()}`)
                    .setColor('#FF2A7A')
                    .addFields(
                        { name: '👤 Nom & Prénom IG', value: `\`${nom}\``, inline: true },
                        { name: '📞 Téléphone', value: `\`${tel}\``, inline: true },
                        { name: '🥋 Style / Spécialité', value: style, inline: false },
                        { name: '🔗 Compte Discord', value: `${interaction.user} (${interaction.user.tag})`, inline: false }
                    )
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: `Gurenkai • Fiche enregistrée par ${interaction.user.username}` })
                    .setTimestamp();

                if (photo.startsWith('http://') || photo.startsWith('https://')) {
                    embedFiche.setImage(photo);
                }

                try {
                    await destChannel.send({ embeds: [embedFiche] });
                    await interaction.reply({ content: '✅ Votre fiche info a bien été transmise !', ephemeral: true });
                } catch (err) {
                    await interaction.reply({ content: '❌ Erreur lors de l\'enregistrement de votre fiche.', ephemeral: true });
                }
            }

            if (interaction.customId === 'embed_builder_modal') {
                const titre = interaction.fields.getTextInputValue('embed_titre');
                const message = interaction.fields.getTextInputValue('embed_message');
                let couleur = interaction.fields.getTextInputValue('embed_couleur').trim() || '#FF2A7A';
                const image = interaction.fields.getTextInputValue('embed_image') || '';
                const miniature = interaction.fields.getTextInputValue('embed_miniature') || '';

                if (couleur && !couleur.startsWith('#')) couleur = '#' + couleur;
                if (!/^#[0-9A-F]{6}$/i.test(couleur)) couleur = '#FF2A7A';

                const embed = new EmbedBuilder()
                    .setColor(couleur)
                    .setDescription(message)
                    .setFooter({ text: `Annonce publiée par ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();

                if (titre) embed.setTitle(titre);
                if (image?.startsWith('http')) embed.setImage(image);
                if (miniature?.startsWith('http')) embed.setThumbnail(miniature);

                try {
                    await interaction.channel.send({ embeds: [embed] });
                    await interaction.reply({ content: '✅ Embed publié avec succès !', ephemeral: true });
                } catch (err) {
                    await interaction.reply({ content: '❌ Impossible d\'envoyer l\'embed.', ephemeral: true });
                }
            }
        }
    }
};