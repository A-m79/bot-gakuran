const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');

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

            const displayName = userData.displayName || userData.name;
            const description = (userData.description && userData.description.trim() !== '') 
                ? userData.description 
                : 'Aucune description renseignée.';
            const createdTimestamp = Math.floor(new Date(userData.created).getTime() / 1000);
            const avatarUrl = avatarData.data && avatarData.data[0] ? avatarData.data[0].imageUrl : null;
            const isBanned = userData.isBanned ? '🔴 **Banni**' : '🟢 **Actif**';

            let presenceStatus = '⚪ **Hors ligne**';
            if (presenceData.userPresences && presenceData.userPresences[0]) {
                const type = presenceData.userPresences[0].userPresenceType;
                if (type === 1) presenceStatus = '🟢 **En ligne (Site)**';
                else if (type === 2) presenceStatus = '🎮 **En jeu**';
                else if (type === 3) presenceStatus = '🛠️ **Sur Roblox Studio**';
            }

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
                    `> 🛡️ **Statut du compte :** ${isBanned}\n` +
                    `> 📅 **Création :** <t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)\n\n` +
                    `### 📊 Statistiques & Réseau\n` +
                    `> 👥 **Amis :** \`${friendsData.count ?? 0}\`\n` +
                    `> 📡 **Abonnés :** \`${followersData.count ?? 0}\`\n` +
                    `> ➕ **Abonnements :** \`${followingsData.count ?? 0}\`\n\n` +
                    `### 📝 Bio / Description\n` +
                    `\`\`\`text\n${description.length > 350 ? description.substring(0, 350) + '...' : description}\n\`\`\``
                )
                .setFooter({ text: 'Gurenkai V2 • Roblox Intelligence', iconURL: interaction.guild.iconURL() })
                .setTimestamp();

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

    async handleButton(interaction) {
        if (!interaction.customId || !interaction.customId.startsWith('rblx_alt_')) return;

        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.customId.replace('rblx_alt_', '');

        try {
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

            let riskScore = 0;
            const breakdown = [];

            const createdDate = new Date(userData.created);
            const ageInDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

            if (ageInDays < 7) {
                riskScore += 45;
                breakdown.push(`> 🔴 **Ancienneté :** Ultra récent (\`${ageInDays} jour(s)\`) ➔ **+45%**`);
            } else if (ageInDays < 30) {
                riskScore += 35;
                breakdown.push(`> 🔴 **Ancienneté :** Récent (\`${ageInDays} jour(s)\`) ➔ **+35%**`);
            } else if (ageInDays < 90) {
                riskScore += 25;
                breakdown.push(`> 🟠 **Ancienneté :** Moins de 3 mois (\`${ageInDays}j\`) ➔ **+25%**`);
            } else if (ageInDays < 180) {
                riskScore += 15;
                breakdown.push(`> 🟡 **Ancienneté :** Moins de 6 mois (\`${ageInDays}j\`) ➔ **+15%**`);
            } else if (ageInDays < 365) {
                riskScore += 8;
                breakdown.push(`> 🟢 **Ancienneté :** Moins d'un an (\`${ageInDays}j\`) ➔ **+8%**`);
            } else {
                breakdown.push(`> 🟢 **Ancienneté :** Compte ancien (\`${Math.floor(ageInDays / 365)} an(s)\`) ➔ **+0%**`);
            }

            if (friendsCount === 0) {
                riskScore += 25;
                breakdown.push(`> 🔴 **Amis :** Aucun ami (\`0\`) ➔ **+25%**`);
            } else if (friendsCount <= 5) {
                riskScore += 18;
                breakdown.push(`> 🟠 **Amis :** Très faible (\`${friendsCount}\`) ➔ **+18%**`);
            } else if (friendsCount <= 15) {
                riskScore += 10;
                breakdown.push(`> 🟡 **Amis :** Modéré (\`${friendsCount}\`) ➔ **+10%**`);
            } else {
                breakdown.push(`> 🟢 **Amis :** Réseau actif (\`${friendsCount}\`) ➔ **+0%**`);
            }

            if (followersCount === 0 && followingsCount === 0) {
                riskScore += 15;
                breakdown.push(`> 🔴 **Abonnés/Suivis :** Inexistants (\`0/0\`) ➔ **+15%**`);
            } else if (followersCount < 3 && followingsCount < 3) {
                riskScore += 8;
                breakdown.push(`> 🟡 **Abonnés/Suivis :** Faibles (\`${followersCount}/${followingsCount}\`) ➔ **+8%**`);
            } else {
                breakdown.push(`> 🟢 **Abonnés/Suivis :** Présents (\`${followersCount}/${followingsCount}\`) ➔ **+0%**`);
            }

            if (!userData.description || userData.description.trim() === '') {
                riskScore += 10;
                breakdown.push(`> 🟡 **Biographie :** Non renseignée ➔ **+10%**`);
            } else {
                breakdown.push(`> 🟢 **Biographie :** Renseignée ➔ **+0%**`);
            }

            const hasAltPattern = /^(alt|test|user|guest|\d{6,})/i.test(userData.name);
            if (hasAltPattern) {
                riskScore += 5;
                breakdown.push(`> ⚠️ **Nom d'utilisateur :** Pattern générique/suspect ➔ **+5%**`);
            }

            const finalScore = Math.min(riskScore, 99);
            const progressBar = generateProgressBar(finalScore);

            let riskLevel = '';
            let color = '#57F287';
            let recommendation = '';

            if (finalScore >= 75) {
                riskLevel = '🔴 **RISQUE CRITIQUE (Alt Trés Probable)**';
                color = '#ED4245';
                recommendation = '⚠️ **Recommandation :** Ce compte cumule la majorité des critères d\'un compte secondaire.';
            } else if (finalScore >= 50) {
                riskLevel = '🟠 **RISQUE ÉLEVÉ (Probabilité Forte)**';
                color = '#E67E22';
                recommendation = '⚠️ **Recommandation :** Compte suspect présentant plusieurs anomalies d\'activité.';
            } else if (finalScore >= 25) {
                riskLevel = '🟡 **RISQUE MODÉRÉ (Prudence)**';
                color = '#F1C40F';
                recommendation = 'ℹ️ **Recommandation :** Risque modéré. Quelques indicateurs manquants.';
            } else {
                riskLevel = '🟢 **RISQUE FAIBLE (Compte Légitime)**';
                color = '#57F287';
                recommendation = '✅ **Recommandation :** Compte ancien avec une activité et un réseau normaux.';
            }

            const auditEmbed = new EmbedBuilder()
                .setTitle(`🛡️ GURENKAI • AUDIT DE DÉTECTION D'ALT`)
                .setColor(color)
                .setDescription(
                    `Rapport d'analyse de sécurité pour **@${userData.name}** (\`${userId}\`)\n\n` +
                    `### 📊 Score de Suspicion\n` +
                    `> ${riskLevel}\n` +
                    `> \`[${progressBar}]\` **${finalScore}%**\n\n` +
                    `### 🔬 Détail du Calcul Algorithmique\n` +
                    `${breakdown.join('\n')}\n\n` +
                    `### 💡 Verdict\n` +
                    `> ${recommendation}`
                )
                .setFooter({ text: 'Gurenkai Security • Rapport Éphémère', iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            return interaction.editReply({ embeds: [auditEmbed] });

        } catch (error) {
            console.error('[ERREUR DÉTECTEUR ALT]', error);
            return interaction.editReply({ content: '❌ Impossible d\'effectuer l\'analyse pour le moment.' });
        }
    }
};