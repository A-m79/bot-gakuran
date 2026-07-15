const { Client, GatewayIntentBits, Collection, EmbedBuilder, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ─── SERVEUR HTTP (nécessaire pour Render / hébergement 24h/24) ───
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ Bot Gakuran en ligne !'));
app.listen(PORT, () => console.log(`🌐 Serveur HTTP actif sur le port ${PORT}`));

// ─── BOT DISCORD ───
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`✅ Commande chargée : /${command.data.name}`);
    }
}

client.once('ready', () => {
    console.log(`\n⛩️  Bot connecté en tant que ${client.user.tag}`);
    console.log(`📋 ${client.commands.size} commande(s) chargée(s)\n`);
    client.user.setActivity('Gakuran | Gang', { type: 3 });
});

// ─── ACTIVITY CHECK — Suivi des réactions ───
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.partial) {
        try { await reaction.fetch(); } catch (e) { return; }
    }
    if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch (e) { return; }
    }

    if (reaction.emoji.name !== '✅') return;

    const checkFile = path.join(__dirname, 'data', 'activitycheck.json');
    if (!fs.existsSync(checkFile)) return;

    let checks;
    try { checks = JSON.parse(fs.readFileSync(checkFile, 'utf8')); } catch (e) { return; }

    const check = checks.find(c => c.messageId === reaction.message.id && !c.reached);
    if (!check) return;

    const users = await reaction.users.fetch();
    const humanCount = users.filter(u => !u.bot).size;

    if (humanCount >= check.objectif) {
        check.reached = true;
        fs.writeFileSync(checkFile, JSON.stringify(checks, null, 2));

        try {
            const channel = await client.channels.fetch(check.channelId);
            const successEmbed = new EmbedBuilder()
                .setTitle('🎉 OBJECTIF ATTEINT — GAKURAN')
                .setDescription(`**${humanCount} membre(s)** ont répondu présent !\n\n> La guilde est mobilisée. Bien joué à tous ! 🔥`)
                .setColor('#00FF88')
                .addFields(
                    { name: '🎯 Objectif fixé',    value: `${check.objectif} réactions`, inline: true },
                    { name: '✅ Réponses reçues',  value: `${humanCount} membres`,        inline: true },
                )
                .setFooter({ text: 'Gakuran Gang • Activity Check' })
                .setTimestamp();

            await channel.send({
                content: '🎊 **Objectif atteint !** @everyone',
                embeds: [successEmbed],
                allowedMentions: { parse: ['everyone'] }
            });
        } catch (e) {
            console.error('[ACTIVITY CHECK]', e.message);
        }
    }
});

// ─── HANDLER COMMANDES & INTERACTIONS ───
client.on('interactionCreate', async interaction => {

    // 1️⃣ GESTION DES COMMANDES SLASH
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);

            // Logs
            const logChannelId = process.env.LOGS_CHANNEL_ID?.trim();
            if (logChannelId) {
                try {
                    const logChannel = await client.channels.fetch(logChannelId);
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
                            .setTitle('📥 Log de Commande — Gakuran')
                            .setColor('#FFD700')
                            .setDescription(`**${interaction.user.tag}** a exécuté une commande.`)
                            .addFields(
                                { name: '👤 Utilisateur', value: `<@${interaction.user.id}>`,  inline: true },
                                { name: '💻 Commande',    value: `\`/${interaction.commandName}\``, inline: true },
                                { name: '📍 Salon',       value: `<#${interaction.channelId}>`, inline: true },
                                { name: '📋 Données',     value: optsText || '_Aucune option_', inline: false }
                            )
                            .setTimestamp();

                        await logChannel.send({ embeds: [logEmbed] });
                    }
                } catch (e) {
                    console.error('[LOGS]', e.message);
                }
            }

        } catch (error) {
            console.error(`❌ Erreur /${interaction.commandName} :`, error);
            const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(msg);
            } else {
                await interaction.reply(msg);
            }
        }
        return; // On arrête ici si c'était une commande slash
    }

    // 2️⃣ GESTION DU CLIC SUR LE BOUTON (OUVRIR LE MODAL)
    if (interaction.isButton()) {
        if (interaction.customId === 'ouvrir_fiche_modal') {
            const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

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
                .setPlaceholder('Décrivez votre style ou rôle (ex: Gakuran noir, pilote...)')
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
                .setLabel('Photo de vous (Lien d\'image)')
                .setPlaceholder('Collez un lien d\'image (Discord, Imgur...)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nomInput),
                new ActionRowBuilder().addComponents(styleInput),
                new ActionRowBuilder().addComponents(telInput),
                new ActionRowBuilder().addComponents(photoInput)
            );

            await interaction.showModal(modal);
        }
        return; // On arrête ici si c'était un clic de bouton
    }

    // 3️⃣ GESTION DE LA SOUMISSION DES FORMULAIRES (MODALS)
    if (interaction.isModalSubmit()) {
        
        // --- FORMULAIRE : FICHE INFO ---
        if (interaction.customId === 'soumettre_fiche_modal') {
            const { EmbedBuilder } = require('discord.js');

            const nom = interaction.fields.getTextInputValue('fiche_nom');
            const style = interaction.fields.getTextInputValue('fiche_style');
            const tel = interaction.fields.getTextInputValue('fiche_tel');
            const photo = interaction.fields.getTextInputValue('fiche_photo') || '';

            const destChannelId = process.env.FICHE_CHANNEL_ID || '1526596000314294453';
            const destChannel = interaction.guild.channels.cache.get(destChannelId);

            if (!destChannel) {
                return interaction.reply({ 
                    content: "❌ Impossible de trouver le salon de réception des fiches. Vérifiez le .env.", 
                    ephemeral: true 
                });
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
                await interaction.reply({ 
                    content: '✅ Votre fiche info a bien été enregistrée et transmise au répertoire de la Gurenkai !', 
                    ephemeral: true 
                });
            } catch (err) {
                console.error('[ERREUR FICHE MODAL]', err);
                await interaction.reply({ 
                    content: '❌ Une erreur technique est survenue lors de l\'enregistrement de votre fiche.', 
                    ephemeral: true 
                });
            }
        }

        // --- FORMULAIRE : CRÉATION DE L'EMBED ---
        if (interaction.customId === 'embed_builder_modal') {
            const { EmbedBuilder } = require('discord.js');

            const titre = interaction.fields.getTextInputValue('embed_titre');
            const message = interaction.fields.getTextInputValue('embed_message');
            let couleur = interaction.fields.getTextInputValue('embed_couleur').trim() || '#FF2A7A';
            const image = interaction.fields.getTextInputValue('embed_image') || '';
            const miniature = interaction.fields.getTextInputValue('embed_miniature') || '';

            // Petite sécurité pour le format du code couleur Hex
            if (couleur && !couleur.startsWith('#')) {
                couleur = '#' + couleur;
            }
            if (!/^#[0-9A-F]{6}$/i.test(couleur)) {
                couleur = '#FF2A7A'; // Retour à la couleur Gurenkai si le code hex est invalide
            }

            const embed = new EmbedBuilder()
                .setColor(couleur)
                .setDescription(message)
                .setFooter({ 
                    text: `Annonce publiée par ${interaction.user.username}`, 
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
                })
                .setTimestamp();

            if (titre) {
                embed.setTitle(titre);
            }

            if (image && (image.startsWith('http://') || image.startsWith('https://'))) {
                embed.setImage(image);
            }
            if (miniature && (miniature.startsWith('http://') || miniature.startsWith('https://'))) {
                embed.setThumbnail(miniature);
            }

            try {
                // Envoie directement l'embed dans le salon où la commande a été lancée
                await interaction.channel.send({ embeds: [embed] });
                
                // Réponse éphémère pour confirmer que c'est fait
                await interaction.reply({ content: '✅ Embed publié avec succès !', ephemeral: true });
            } catch (err) {
                console.error('[ERREUR CREATION EMBED]', err);
                await interaction.reply({ content: '❌ Impossible d\'envoyer l\'embed dans ce salon.', ephemeral: true });
            }
        }
        
        return;
    }
});

client.login(process.env.TOKEN);
