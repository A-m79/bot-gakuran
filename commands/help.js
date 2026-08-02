const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ComponentType 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('⛩️ Affiche le menu d\'aide interactif du Bot Gurenkai'),

    async execute(interaction) {
        // --- EMBED PRINCIPAL (Accueil) ---
        const mainEmbed = new EmbedBuilder()
            .setTitle('⛩️ MENU — GURENKAI V2')
            .setColor('#FF2A7A')
            .setDescription(
                'Bienvenue sur le menu du bot **Gurenkai**.\n' +
                'Utilise le **menu déroulant ci-dessous** pour explorer les différentes catégories de commandes disponibles.\n\n' +
                '> 💡 *Besoin d\'assistance supplémentaire ? Contacte un membre du Staff.*'
            )
            .addFields(
                { name: '🌐 Général & Utilaire',       value: '`/ping`, `/info`, `/embed`', inline: true },
                { name: '📊 Activité & Événements', value: '`/activitycheck`, `/sondage`, `/evenement`', inline: true },
                { name: '📜 Absences & Registre',   value: '`/absence`, `/liste-absences`, `/repertoire`', inline: true },
                { name: '🏆 Gang & Divertissement', value: '`/giveaway`, `/leaderboard`, `/kos`, `/relations`', inline: true }
            )
            .setFooter({ text: 'Gurenkai Gang • Menu Interactif V2', iconURL: interaction.guild.iconURL({ dynamic: true }) })
            .setTimestamp();

        // --- MENU DÉROULANT ---
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder('📂 Choisis une catégorie à afficher...')
            .addOptions([
                {
                    label: 'Général & Utilaire',
                    description: 'Informations, latence et création d\'embeds',
                    value: 'cat_general',
                    emoji: '⚙️'
                },
                {
                    label: 'Activité & Événements',
                    description: 'Checks d\'activité, sondages et évènements de guilde',
                    value: 'cat_activity',
                    emoji: '📊'
                },
                {
                    label: 'Absences & Registre',
                    description: 'Déclarer ou consulter les absences et fiches membres',
                    value: 'cat_absence',
                    emoji: '📜'
                },
                {
                    label: 'Gang & Divertissement',
                    description: 'Giveaways, classements, liste KOS et relations',
                    value: 'cat_gang',
                    emoji: '🏆'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // Envoi du message initial
        const response = await interaction.reply({
            embeds: [mainEmbed],
            components: [row],
            ephemeral: true,
            withResponse: true
        });

        // --- COLLECTEUR D'INTERACTIONS ---
        const target = response.resource ? response.resource.message : response;
        const collector = target.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: i => i.customId === 'help_category_select' && i.user.id === interaction.user.id,
            time: 120000
        });

        collector.on('collect', async i => {
            const selected = i.values[0];
            const updatedEmbed = new EmbedBuilder()
                .setColor('#FF2A7A')
                .setFooter({ text: 'Gurenkai Gang • Menu Interactif V2', iconURL: interaction.guild.iconURL({ dynamic: true }) })
                .setTimestamp();

            switch (selected) {
                case 'cat_general':
                    updatedEmbed
                        .setTitle('⚙️ Catégorie — Général & Utile')
                        .setDescription('Voici les commandes d\'informations générales :')
                        .addFields(
                            { name: '`/ping`', value: 'Affiche la latence du bot et de l\'API Discord.' },
                            { name: '`/info [@membre]`', value: 'Affiche le profil Discord complet d\'un membre.' },
                            { name: '`/embed`', value: 'Ouvre un formulaire pour créer un message stylisé (réservé Staff).' }
                        );
                    break;

                case 'cat_activity':
                    updatedEmbed
                        .setTitle('📊 Catégorie — Activité & Événements')
                        .setDescription('Outils de mobilisation et d\'organisation :')
                        .addFields(
                            { name: '`/activitycheck [objectif] [raison]`', value: 'Lance un appel à la mobilisation avec objectif de réactions.' },
                            { name: '`/sondage [question]`', value: 'Crée un vote rapide pour la guilde.' },
                            { name: '`/liste-sondage`', value: 'Affiche la liste des sondages en cours.' },
                            { name: '`/evenement`', value: 'Planifie un rassemblement ou une sortie de gang.' },
                            { name: '`/liste-event`', value: 'Consulte les événements à venir.' }
                        );
                    break;

                case 'cat_absence':
                    updatedEmbed
                        .setTitle('📜 Catégorie — Absences & Registre')
                        .setDescription('Gestion des présences au sein du gang :')
                        .addFields(
                            { name: '`/absence [debut] [fin] [raison]`', value: 'Déclare une période d\'absence officielle.' },
                            { name: '`/liste-absences`', value: 'Affiche les membres actuellement absents.' },
                            { name: '`/supprimer-absence`', value: 'Annule ta déclaration d\'absence.' },
                            { name: '`/setup-fiche`', value: 'Envoie le bouton pour remplir la fiche IG (réservé Staff).' },
                            { name: '`/repertoire`', value: 'Affiche le lien vers le répertoire des fiches.' }
                        );
                    break;

                case 'cat_gang':
                    updatedEmbed
                        .setTitle('🏆 Catégorie — Gang & Divertissement')
                        .setDescription('Module d\'animation et de rivalités :')
                        .addFields(
                            { name: '`/giveaway`', value: 'Lance un concours pour faire gagner un lot.' },
                            { name: '`/leaderboard`', value: 'Affiche le classement des membres les plus actifs.' },
                            { name: '`/kos`', value: 'Affiche ou gère la liste Kill On Sight (Cibles prioritaires).' },
                            { name: '`/relations`', value: 'Consulte l\'état des alliances et rivalités du gang.' }
                        );
                    break;
            }

            await i.update({ embeds: [updatedEmbed], components: [row] });
        });

        collector.on('end', async () => {
            selectMenu.setDisabled(true);
            const disabledRow = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.editReply({ components: [disabledRow] }).catch(() => null);
        });
    }
};