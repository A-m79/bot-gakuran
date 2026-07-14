const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-fiche')
        .setDescription('⚙️ Installer le système de création de fiches infos'),
    async execute(interaction) {
        // Récupération et vérification du grade autorisé depuis le .env
        const authorizedRoles = (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim());
        const aLeGrade = interaction.member.roles.cache.some(r => authorizedRoles.includes(r.id));
        
        if (!aLeGrade) {
            return interaction.reply({ 
                content: "❌ Vous n'avez pas l'autorisation d'utiliser cette commande.", 
                ephemeral: true 
            });
        }

        // Création de l'embed d'accueil
        const embed = new EmbedBuilder()
            .setTitle('⛩️ RÉPERTOIRE OFFICIEL — GURENKAI')
            .setDescription(
                'Afin de recenser tous nos effectifs, organiser nos équipes et enregistrer vos contacts, **chaque membre doit obligatoirement créer sa fiche info**.\n\n' +
                'Pour cela, rien de plus simple :\n' +
                '1️⃣ Cliquez sur le bouton ci-dessous.\n' +
                '2️⃣ Remplissez les informations demandées (*uniquement vos données en jeu*).\n' +
                '3️⃣ Envoyez le formulaire !\n\n' +
                '*Note : Pour la photo de vous, hébergez-la sur Discord ou un site comme Imgur et collez simplement le lien.*'
            )
            .setColor('#FF2A7A') // Rose/Rouge Gurenkai 🐉
            .setFooter({ text: 'Gurenkai • Base de données sécurisée' })
            .setTimestamp();

        // Création du bouton interactif
        const bouton = new ButtonBuilder()
            .setCustomId('ouvrir_fiche_modal')
            .setLabel('📝 Créer ma fiche info')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(bouton);

        await interaction.reply({ content: '⚙️ Système de fiche déployé avec succès !', ephemeral: true });
        await interaction.channel.send({ embeds: [embed], components: [row] });
    }
};