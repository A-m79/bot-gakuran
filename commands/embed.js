const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Envoyer un message stylisé sous forme d\'embed')
        // Limite la commande aux membres qui ont la permission de gérer les messages (Modos/Staff)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Le contenu de l\'embed (écrivez \\n pour aller à la ligne)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('titre')
                .setDescription('Le titre de l\'embed (optionnel)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('couleur')
                .setDescription('La couleur de l\'embed')
                .setRequired(false)
                .addChoices(
                    { name: '🔴 Rouge Gurenkai', value: '#FF2A7A' },
                    { name: '🟡 Or', value: '#FFD700' },
                    { name: '🔵 Bleu', value: '#0099FF' },
                    { name: '🟢 Vert', value: '#00FF00' },
                    { name: '⚫ Noir', value: '#000000' },
                    { name: '⚪ Blanc', value: '#FFFFFF' }
                )
        )
        .addChannelOption(option =>
            option.setName('salon')
                .setDescription('Le salon où envoyer l\'embed (par défaut : le salon actuel)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('image')
                .setDescription('Lien d\'une grande image tout en bas (optionnel)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('miniature')
                .setDescription('Lien d\'une petite image en haut à droite (optionnel)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('mention')
                .setDescription('Ajouter une notification au-dessus du message')
                .setRequired(false)
                .addChoices(
                    { name: 'Aucune', value: 'none' },
                    { name: '🔔 @everyone', value: 'everyone' },
                    { name: '📌 @here', value: 'here' }
                )
        ),

    async execute(interaction) {
        const message = interaction.options.getString('message').replace(/\\n/g, '\n');
        const titre = interaction.options.getString('titre');
        const couleur = interaction.options.getString('couleur') || '#FF2A7A'; // Rouge Gurenkai par défaut
        const salon = interaction.options.getChannel('salon') || interaction.channel;
        const image = interaction.options.getString('image');
        const miniature = interaction.options.getString('miniature');
        const mentionOpt = interaction.options.getString('mention');

        // Construction de l'embed personnalisé
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

        // Vérification et ajout des images si fournies
        if (image && (image.startsWith('http://') || image.startsWith('https://'))) {
            embed.setImage(image);
        }
        if (miniature && (miniature.startsWith('http://') || miniature.startsWith('https://'))) {
            embed.setThumbnail(miniature);
        }

        // Préparation de l'envoi (avec ou sans ping)
        const sendOptions = { embeds: [embed] };
        if (mentionOpt && mentionOpt !== 'none') {
            sendOptions.content = mentionOpt === 'everyone' ? '@everyone' : '@here';
        }

        try {
            // Envoi de l'embed dans le salon de destination
            await salon.send(sendOptions);
            
            // Confirmation privée pour l'admin/modo
            await interaction.reply({ 
                content: `✅ L'embed a bien été envoyé dans le salon <#${salon.id}> !`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('[ERREUR ENVOI EMBED]', error);
            await interaction.reply({ 
                content: '❌ Impossible d\'envoyer l\'embed. Vérifie que le bot a bien les permissions d\'écrire dans ce salon.', 
                ephemeral: true 
            });
        }
    }
};