const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');

// Fonction pour générer une barre de progression visuelle en caractères Unicode
function generateProgressBar(percent) {
    const totalBlocks = 10;
    const filledBlocks = Math.round((percent / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rblx-info')
        .setDescription('🔍 Affiche les informations d\'un joueur Roblox et analyse son risque d\'Alt')
        .addStringOption(option => 
            option.setName('username')
                .setDescription('Le pseudo Roblox du joueur')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const username = interaction.options.getString('username');

        try {
            // 1. Recherche de l'ID Roblox via le pseudo
            const searchRes = await fetch('https://users.roblox.com/v1/usernames/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
            });

            const searchData = await searchRes.json();

            if (!searchData.data || searchData.data.length === 0) {
                return interaction.editReply({ 
                    content: `❌ **Utilisateur introuvable** : Impossible de trouver le profil Roblox \`${username}\`.` 
                });
            }

            const userId = searchData.data[0].id;

            // 2. Récupération des détails et statut en ligne
            const [userRes, avatarRes, friendsRes, followersRes, followingsRes, presenceRes] = await Promise.all([
                fetch(`https://users.roblox.com/v1/users/${userId}`),
                fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`),
                fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
                fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
                fetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`),
                fetch('https://presence.roblox.com/v1/presence/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userIds: [userId] })
                })
            ]);

            const userData = await userRes.json();
            const avatarData = await avatarRes.json();
            const friendsData = await friendsRes.json();
            const followersData = await followersRes.json();
            const followingsData = await followingsRes.json();
            const presenceData = await presenceRes.json();

            // Variables de profil
            const displayName = userData.displayName || userData.name;
            const description = (userData.description && userData.description.trim() !== '') 
                ? userData.description 
                : 'Aucune description renseignée.';
            const createdTimestamp = Math.floor(new Date(userData.created).getTime() / 1000);
            const avatarUrl = avatarData.data && avatarData.data[0] ? avatarData.data[0].imageUrl : null;
            const isBanned = userData.isBanned ? '🔴 **Banni**' : '🟢 **Actif (Non Banni)**';

            let presenceStatus = '⚪ Hors ligne';
            if (presenceData.userPresences && presenceData.userPresences[0]) {
                const type = presenceData.userPresences[0].userPresenceType;
                if (type === 1) presenceStatus = '🟢 En ligne (Site)';
                else if (type === 2) presenceStatus = '🎮 En jeu';
                else if (type === 3) presenceStatus = '🛠️ Sur Roblox Studio';
            }

            // Embed Profil Principal
            const embed = new EmbedBuilder()
                .setTitle(`🎮 GURENKAI • PROFIL ROBLOX`)
                .setColor('#FF2A7A')
                .setThumbnail(avatarUrl)
                .setDescription(
                    `### 👤 Identité du Joueur\n` +
                    `> 📛 **Nom d'affichage :** \`${displayName}\`\n` +
                    `> 🏷️ **Nom d'utilisateur :** \`@${userData.name}\`\n` +
                    `> 🆔 **ID Roblox :** \`${userId}\`\n` +
                    `> 🌐 **Activité :** ${presenceStatus}\n` +
                    `> 🛡️ **Statut :** ${isBanned}\n` +
                    `> 📅 **Membre depuis :** <t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)\n\n` +
                    `### 📊 Statistiques & Réseau\n` +
                    `> 👥 **Amis :** \`${friendsData.count ?? 0}\`  •  📡 **Abonnés :** \`${followersData.count ?? 0}\`  •  ➕ **Abonnements :** \`${followingsData.count ?? 0}\`\n\n` +
                    `### 📝 Bio / Description\n` +
                    `\`\`\`fix\n${description.length > 400 ? description.substring(0, 400) + '...' : description}\n\`\`\``
                )
                .setFooter({ text: 'Gurenkai V2 • Roblox Intelligence', iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            // Boutons d'action (Liens + Bouton d'analyse d'Alt)
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Profil Roblox')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://www.roblox.com/users/${userId}/profile`),
                new ButtonBuilder()
                    .setLabel('Inventaire')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://www.roblox.com/users/${userId}/inventory`),
                new ButtonBuilder()
                    .setCustomId(`rblx_alt_${userId}`)
                    .setLabel('🛡️ Analyser Risque d\'Alt')
                    .setStyle(ButtonStyle.Primary)
            );

            return interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('[ERREUR ROBLOX LOOKUP]', error);
            return interaction.editReply({ 
                content: '❌ **Erreur système** : Impossible de contacter l\'API Roblox pour le moment.' 
            });
        }
    },

    // Gestionnaire du bouton de détection d'Alt
    async handleButton(interaction) {
        if (!interaction.customId || !interaction.customId.startsWith('rblx_alt_')) return;

        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.customId.replace('rblx_alt_', '');

        try {
            // Récupération des données nécessaires au calcul
            const [userRes, friendsRes, followersRes, followingsRes] = await Promise.all([
                fetch(`https://users.roblox.com/v1/users/${userId}`),
                fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
                fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
                fetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`)
            ]);

            const userData = await userRes.json();
            const friendsCount = (await friendsRes.json()).count ?? 0;
            const followersCount = (await followersRes.json()).count ?? 0;
            const followingsCount = (await followingsRes.json()).count ?? 0;

            // --- CALCULATEUR DE RISQUE D'ALT ---
            let riskScore = 0;
            const breakdown = [];

            // 1. Âge du compte (Création)
            const createdDate = new Date(userData.created);
            const ageInDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

            if (ageInDays < 7) {
                riskScore += 45;
                breakdown.push(`> 🔴 **Âge du compte :** Très récent (\`${ageInDays}j\`) ➔ **+45%**`);
            } else if (ageInDays < 30) {
                riskScore += 35;
                breakdown.push(`> 🔴 **Âge du compte :** Récent (\`${ageInDays}j\`) ➔ **+35%**`);
            } else if (ageInDays < 90) {
                riskScore += 25;
                breakdown.push(`> 🟠 **Âge du compte :** Moins de 3 mois (\`${ageInDays}j\`) ➔ **+25%**`);
            } else if (ageInDays < 180) {
                riskScore += 15;
                breakdown.push(`> 🟡 **Âge du compte :** Moins de 6 mois (\`${ageInDays}j\`) ➔ **+15%**`);
            } else if (ageInDays < 365) {
                riskScore += 8;
                breakdown.push(`> 🟢 **Âge du compte :** Moins d'un an (\`${ageInDays}j\`) ➔ **+8%**`);
            } else {
                breakdown.push(`> 🟢 **Âge du compte :** Ancien (\`${Math.floor(ageInDays / 365)} an(s)\`) ➔ **+0%**`);
            }

            // 2. Nombre d'Amis
            if (friendsCount === 0) {
                riskScore += 25;
                breakdown.push(`> 🔴 **Réseau d'amis :** Aucun ami (\`0\`) ➔ **+25%**`);
            } else if (friendsCount <= 5) {
                riskScore += 18;
                breakdown.push(`> 🟠 **Réseau d'amis :** Faible (\`${friendsCount} amis\`) ➔ **+18%**`);
            } else if (friendsCount <= 15) {
                riskScore += 10;
                breakdown.push(`> 🟡 **Réseau d'amis :** Modéré (\`${friendsCount} amis\`) ➔ **+10%**`);
            } else {
                breakdown.push(`> 🟢 **Réseau d'amis :** Actif (\`${friendsCount} amis\`) ➔ **+0%**`);
            }

            // 3. Followers / Followings
            if (followersCount === 0 && followingsCount === 0) {
                riskScore += 15;
                breakdown.push(`> 🔴 **Abonnés & Suivis :** Inexistants (\`0/0\`) ➔ **+15%**`);
            } else if (followersCount < 3 && followingsCount < 3) {
                riskScore += 8;
                breakdown.push(`> 🟡 **Abonnés & Suivis :** Faibles (\`${followersCount}/${followingsCount}\`) ➔ **+8%**`);
            } else {
                breakdown.push(`> 🟢 **Abonnés & Suivis :** Présents (\`${followersCount}/${followingsCount}\`) ➔ **+0%**`);
            }

            // 4. Biographie
            if (!userData.description || userData.description.trim() === '') {
                riskScore += 10;
                breakdown.push(`> 🟡 **Biographie :** Non renseignée (Vierge) ➔ **+10%**`);
            } else if (userData.description.length < 15) {
                riskScore += 5;
                breakdown.push(`> 🟢 **Biographie :** Très courte ➔ **+5%**`);
            } else {
                breakdown.push(`> 🟢 **Biographie :** Complétée ➔ **+0%**`);
            }

            // 5. Analyse du motif de Pseudo (Regex de détection de pattern d'Alt)
            const hasAltPattern = /^(alt|test|user|guest|\d{6,})/i.test(userData.name);
            if (hasAltPattern) {
                riskScore += 5;
                breakdown.push(`> ⚠️ **Motif d'identifiant :** Nom générique ou suspect ➔ **+5%**`);
            }

            // Plafonner le résultat final à 99% max
            const finalScore = Math.min(riskScore, 99);
            const progressBar = generateProgressBar(finalScore);

            // Détermination du niveau de menace et de la couleur
            let riskLevel = '';
            let color = '#57F287'; // Vert par défaut
            let recommendation = '';

            if (finalScore >= 75) {
                riskLevel = '🔴 **RISQUE CRITIQUE (Très Forte Probabilité d\'Alt)**';
                color = '#ED4245';
                recommendation = '⚠️ **Recommandation :** Ce compte coche presque tous les critères d\'un compte secondaire/Alt. Prudence extrême recommandée.';
            } else if (finalScore >= 50) {
                riskLevel = '🟠 **RISQUE ÉLEVÉ (Probabilité d\'Alt Élevée)**';
                color = '#E67E22';
                recommendation = '⚠️ **Recommandation :** Compte présentant plusieurs anomalies (récent ou sans activité sociale). À surveiller.';
            } else if (finalScore >= 25) {
                riskLevel = '🟡 **RISQUE MODÉRÉ (Compte Suspect)**';
                color = '#F1C40F';
                recommendation = 'ℹ️ **Recommandation :** Risque faible à moyen. Quelques indicateurs sont absents mais rien d\'alarmant.';
            } else {
                riskLevel = '🟢 **RISQUE FAIBLE (Compte Principal Probable)**';
                color = '#57F287';
                recommendation = '✅ **Recommandation :** Ce compte possède une ancienneté et une activité sociale normales.';
            }

            // Construction de l'embed d'analyse
            const auditEmbed = new EmbedBuilder()
                .setTitle(`🛡️ GURENKAI • AUDIT DE DÉTECTION D'ALT`)
                .setColor(color)
                .setDescription(
                    `Analyse algorithmique de sécurité effectuée pour le profil **@${userData.name}** (\`${userId}\`).\n\n` +
                    `### 📊 Score de Suspicion\n` +
                    `> ${riskLevel}\n` +
                    `> \`[${progressBar}]\` **${finalScore}% de probabilité d'être un Alt**\n\n` +
                    `### 🔬 Détail du Calcul Algorithmique\n` +
                    `${breakdown.join('\n')}\n\n` +
                    `### 💡 Verdict & Recommandation\n` +
                    `> ${recommendation}`
                )
                .setFooter({ text: 'Gurenkai Security System • Confidential Audit', iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            return interaction.editReply({ embeds: [auditEmbed] });

        } catch (error) {
            console.error('[ERREUR DÉTECTEUR ALT]', error);
            return interaction.editReply({ content: '❌ Impossible d\'effectuer l\'analyse pour le moment.' });
        }
    }
};