const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('repertoire')
        .setDescription('📖 Afficher le répertoire téléphonique de tous les membres de la Gurenkai'),

    async execute(interaction) {
        // Message éphémère (privé) pour ne pas spammer les salons
        await interaction.deferReply({ ephemeral: true });

        const destChannelId = process.env.FICHE_CHANNEL_ID || '1526596000314294453';
        let destChannel;

        try {
            // Sécurité anti-redémarrage : cherche dans le cache, sinon force le téléchargement du salon
            destChannel = interaction.guild.channels.cache.get(destChannelId) 
                || await interaction.guild.channels.fetch(destChannelId);
        } catch (err) {
            console.error('[REPERTOIRE FETCH ERROR]', err);
        }

        if (!destChannel) {
            return interaction.editReply({ 
                content: "❌ Impossible d'accéder au répertoire pour le moment. Veuillez contacter un administrateur."
            });
        }

        try {
            // Récupère les 100 dernières fiches postées par le bot
            const messages = await destChannel.messages.fetch({ limit: 100 });
            const fiches = [];

            messages.forEach(msg => {
                if (msg.author.id === interaction.client.user.id && msg.embeds.length > 0) {
                    const embed = msg.embeds[0];
                    if (embed.title && embed.title.startsWith("👤 FICHE D'IDENTITÉ")) {
                        
                        let nom = "Inconnu";
                        let tel = "Aucun";
                        let discord = "Non lié";

                        embed.fields.forEach(field => {
                            if (field.name.includes("Nom & Prénom")) nom = field.value.replace(/`/g, '');
                            if (field.name.includes("Téléphone")) tel = field.value.replace(/`/g, '');
                            if (field.name.includes("Compte Discord")) discord = field.value;
                        });

                        fiches.push({ nom, tel, discord });
                    }
                }
            });

            if (fiches.length === 0) {
                return interaction.editReply({ 
                    content: "📭 Aucun membre n'est encore enregistré dans le répertoire." 
                });
            }

            // Tri par ordre alphabétique
            fiches.sort((a, b) => a.nom.localeCompare(b.nom));

            let listeTexte = "";
            fiches.forEach((f, index) => {
                listeTexte += `**${index + 1}.** 👤 \`${f.nom}\` ➔ 📞 **\`${f.tel}\`** (${f.discord})\n`;
            });

            const embedRepertoire = new EmbedBuilder()
                .setTitle('⛩️ RÉPERTOIRE DES CONTACTS — GURENKAI')
                .setColor('#FF2A7A') // Rose/Rouge Gurenkai 🐉
                .setDescription(listeTexte)
                .setFooter({ text: `Total : ${fiches.length} membres enregistrés` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embedRepertoire] });

        } catch (error) {
            console.error('[ERREUR REPERTOIRE]', error);
            await interaction.editReply({ 
                content: "❌ Une erreur est survenue lors de la génération du répertoire." 
            });
        }
    }
};