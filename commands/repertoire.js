const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('repertoire')
        .setDescription('📖 Afficher le répertoire des fiches de tous les membres de la Gurenkai'),

    async execute(interaction) {
        // 1. Vérification du grade autorisé depuis le .env
        const authorizedRoles = (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim());
        const aLeGrade = interaction.member.roles.cache.some(r => authorizedRoles.includes(r.id));
        
        if (!aLeGrade) {
            return interaction.reply({ 
                content: "❌ Vous n'avez pas l'autorisation de consulter le répertoire des fiches.", 
                ephemeral: true 
            });
        }

        // Différer la réponse car la lecture des messages peut prendre 1 à 2 secondes
        await interaction.deferReply({ ephemeral: true });

        // 2. Récupération du salon de réception des fiches
        const destChannelId = process.env.FICHE_CHANNEL_ID || '1526596000314294453';
        const destChannel = interaction.guild.channels.cache.get(destChannelId);

        if (!destChannel) {
            return interaction.editReply({ 
                content: "❌ Impossible de trouver le salon contenant les fiches infos. Vérifiez le fichier .env."
            });
        }

        try {
            // 3. Récupération des 100 derniers messages du salon des fiches
            const messages = await destChannel.messages.fetch({ limit: 100 });
            const fiches = [];

            messages.forEach(msg => {
                // On ne prend que les messages du bot qui contiennent des embeds de fiche
                if (msg.author.id === interaction.client.user.id && msg.embeds.length > 0) {
                    const embed = msg.embeds[0];
                    if (embed.title && embed.title.startsWith("👤 FICHE D'IDENTITÉ")) {
                        
                        let nom = "Inconnu";
                        let tel = "Aucun";
                        let discord = "Non lié";

                        // Extraction des champs de l'embed
                        embed.fields.forEach(field => {
                            if (field.name.includes("Nom & Prénom")) nom = field.value.replace(/`/g, '');
                            if (field.name.includes("Téléphone")) tel = field.value.replace(/`/g, '');
                            if (field.name.includes("Compte Discord")) discord = field.value;
                        });

                        fiches.push({ nom, tel, discord });
                    }
                }
            });

            // 4. Si aucune fiche n'est trouvée
            if (fiches.length === 0) {
                return interaction.editReply({ 
                    content: "📭 Aucun membre n'est encore enregistré dans le répertoire pour le moment." 
                });
            }

            // 5. Tri par ordre alphabétique des noms IG
            fiches.sort((a, b) => a.nom.localeCompare(b.nom));

            // 6. Construction de la liste sous forme d'embed ultra propre
            let listeTexte = "";
            fiches.forEach((f, index) => {
                listeTexte += `**${index + 1}.** 👤 \`${f.nom}\` ➔ 📞 **\`${f.tel}\`** (${f.discord})\n`;
            });

            const embedRepertoire = new EmbedBuilder()
                .setTitle('⛩️ RÉPERTOIRE DES FICHES — GURENKAI')
                .setColor('#FF2A7A') // Charte graphique Gurenkai 🐉
                .setDescription(listeTexte)
                .setFooter({ text: `Total : ${fiches.length} membres enregistrés` })
                .setTimestamp();

            // Envoi du répertoire en privé à l'utilisateur
            await interaction.editReply({ embeds: [embedRepertoire] });

        } catch (error) {
            console.error('[ERREUR REPERTOIRE]', error);
            await interaction.editReply({ 
                content: "❌ Une erreur est survenue lors de la génération du répertoire." 
            });
        }
    }
};