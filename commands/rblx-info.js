const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');

// Algorithme de calcul de similarité de texte (Levenshtein) pour les pseudos
function calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));

    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;

    for (let j = 1; j <= s2.length; j += 1) {
        for (let i = 1; i <= s1.length; i += 1) {
            const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1,
                track[j - 1][i] + 1,
                track[j - 1][i - 1] + indicator
            );
        }
    }
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 100;
    return Math.round((1 - track[s2.length][s1.length] / maxLen) * 100);
}

function generateProgressBar(percent) {
    const totalBlocks = 10;
    const filledBlocks = Math.round((percent / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rblx-info')
        .setDescription('🔍 Profil Roblox, détection d\'Alt & analyse croisée')
        .addStringOption(option => 
            option.setName('username')
                .setDescription('Le pseudo Roblox du joueur à analyser')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('compte_principal')
                .setDescription('Optionnel : Pseudo du compte Main suspecté (pour analyse croisée)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const username = interaction.options.getString('username');
        const mainUsername = interaction.options.getString('compte_principal');

        try {
            // Fetch infos compte principal (target)
            const searchRes = await fetch('https://users.roblox.com/v1/usernames/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
            });

            const searchData = await searchRes.json();
            if (!searchData.data || searchData.data.length === 0) {
                return interaction.editReply({ content: `❌ **Utilisateur introuvable** : Impossible de trouver \`${username}\`.` });
            }

            const targetUser = searchData.data[0];

            // Fetch APIs Roblox (Solo Audit + Groupes + Badges)
            const [userRes, avatarRes, friendsRes, followersRes, followingsRes, presenceRes, groupsRes, badgesRes] = await Promise.all([
                fetch(`https://users.roblox.com/v1/users/${targetUser.id}`),
                fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${targetUser.id}&size=420x420&format=Png&isCircular=false`),
                fetch(`https://friends.roblox.com/v1/users/${targetUser.id}/friends/count`),
                fetch(`https://friends.roblox.com/v1/users/${targetUser.id}/followers/count`),
                fetch(`https://friends.roblox.com/v1/users/${targetUser.id}/followings/count`),
                fetch('https://presence.roblox.com/v1/presence/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userIds: [targetUser.id] })
                }),
                fetch(`https://groups.roblox.com/v1/users/${targetUser.id}/groups/roles`),
                fetch(`https://badges.roblox.com/v1/users/${targetUser.id}/badges?limit=100&sortOrder=Desc`)
            ]);

            const userData = await userRes.json();
            const avatarData = await avatarRes.json();
            const friendsCount = (await friendsRes.json()).count ?? 0;
            const followersCount = (await followersRes.json()).count ?? 0;
            const followingsCount = (await followingsRes.json()).count ?? 0;
            const presenceData = await presenceRes.json();
            const groupsData = await groupsRes.json();
            const badgesData = await badgesRes.json();

            const groupsCount = groupsData.data ? groupsData.data.length : 0;
            const badgesCount = badgesData.data ? badgesData.data.length : 0;

            const displayName = userData.displayName || userData.name;
            const description = (userData.description && userData.description.trim() !== '') ? userData.description : 'Aucune description.';
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

            // --- EMBED PROFIL PRINCIPAL ---
            const embed = new EmbedBuilder()
                .setTitle(`🎮 GURENKAI • PROFIL ROBLOX`)
                .setColor('#FF2A7A')
                .setThumbnail(avatarUrl)
                .setDescription(
                    `### 👤 Identité du Joueur\n` +
                    `> 📛 **Display Name :** \`${displayName}\`\n` +
                    `> 🏷️ **Username :** \`@${userData.name}\`\n` +
                    `> 🆔 **ID Roblox :** \`${userData.id}\`\n` +
                    `> 🌐 **Activité :** ${presenceStatus}\n` +
                    `> 🛡️ **Statut :** ${isBanned}\n` +
                    `> 📅 **Création :** <t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)\n\n` +
                    `### 📊 Statistiques & Activité Jeux\n` +
                    `> 👥 **Amis :** \`${friendsCount}\` | 📡 **Abonnés :** \`${followersCount}\`\n` +
                    `> 🏰 **Groupes rejoints :** \`${groupsCount}\`\n` +
                    `> 🏅 **Badges débloqués :** \`${badgesCount >= 100 ? '100+' : badgesCount}\`\n\n` +
                    `### 📝 Bio / Description\n` +
                    `\`\`\`text\n${description.length > 250 ? description.substring(0, 250) + '...' : description}\n\`\`\``
                )
                .setFooter({ text: 'Gurenkai V2 • Roblox Intelligence', iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            // Bouton dynamique selon si un compte principal a été passé ou non
            const customButtonId = mainUsername 
                ? `rblx_compare_${targetUser.id}_${encodeURIComponent(mainUsername)}` 
                : `rblx_alt_${targetUser.id}`;

            const buttonLabel = mainUsername 
                ? `⚔️ Comparer avec @${mainUsername}` 
                : `🛡️ Analyser Risque d'Alt`;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Profil Roblox').setStyle(ButtonStyle.Link).setURL(`https://www.roblox.com/users/${targetUser.id}/profile`),
                new ButtonBuilder().setLabel('Inventaire').setStyle(ButtonStyle.Link).setURL(`https://www.roblox.com/users/${targetUser.id}/inventory`),
                new ButtonBuilder().setCustomId(customButtonId).setLabel(buttonLabel).setStyle(mainUsername ? ButtonStyle.Danger : ButtonStyle.Primary)
            );

            return interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('[ERREUR ROBLOX LOOKUP]', error);
            return interaction.editReply({ content: '❌ **Erreur système** : Impossible de contacter l\'API Roblox.' });
        }
    },

    async handleButton(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // MODE 1 : ANALYSE CROISÉE (Alt vs Main)
        if (interaction.customId.startsWith('rblx_compare_')) {
            const parts = interaction.customId.split('_');
            const targetId = parts[2];
            const mainUsername = decodeURIComponent(parts[3]);

            try {
                // Fetch le compte Main
                const mainSearch = await fetch('https://users.roblox.com/v1/usernames/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usernames: [mainUsername], excludeBannedUsers: false })
                });
                const mainData = (await mainSearch.json()).data?.[0];

                if (!mainData) {
                    return interaction.editReply({ content: `❌ Impossible de trouver le compte principal \`${mainUsername}\`.` });
                }

                // API Calls parallèles pour les 2 comptes
                const [targetUser, mainUser, targetFriends, mainFriends, targetGroups, mainGroups] = await Promise.all([
                    fetch(`https://users.roblox.com/v1/users/${targetId}`).then(r => r.json()),
                    fetch(`https://users.roblox.com/v1/users/${mainData.id}`).then(r => r.json()),
                    fetch(`https://friends.roblox.com/v1/users/${targetId}/friends`).then(r => r.json()),
                    fetch(`https://friends.roblox.com/v1/users/${mainData.id}/friends`).then(r => r.json()),
                    fetch(`https://groups.roblox.com/v1/users/${targetId}/groups/roles`).then(r => r.json()),
                    fetch(`https://groups.roblox.com/v1/users/${mainData.id}/groups/roles`).then(r => r.json())
                ]);

                let matchScore = 0;
                const breakdown = [];

                // 1. Similarité de Pseudo (Levenshtein)
                const simScore = calculateSimilarity(targetUser.name, mainUser.name);
                if (simScore >= 70) {
                    matchScore += 35;
                    breakdown.push(`> 🔴 **Pseudos presque identiques :** \`${simScore}%\` de similarité ➔ **+35%**`);
                } else if (simScore >= 40) {
                    matchScore += 20;
                    breakdown.push(`> 🟠 **Pseudos similaires :** \`${simScore}%\` de similarité ➔ **+20%**`);
                } else {
                    breakdown.push(`> 🟢 **Pseudos différents :** \`${simScore}%\` de similarité ➔ **+0%**`);
                }

                // 2. Amis en Commun (Cross-reference)
                const targetFriendsIds = new Set((targetFriends.data || []).map(f => f.id));
                const mainFriendsIds = (mainFriends.data || []).map(f => f.id);
                const commonFriends = mainFriendsIds.filter(id => targetFriendsIds.has(id));

                if (commonFriends.length >= 5) {
                    matchScore += 40;
                    breakdown.push(`> 🔴 **Réseau commun massif :** \`${commonFriends.length}\` amis en commun ➔ **+40%**`);
                } else if (commonFriends.length >= 1) {
                    matchScore += 20;
                    breakdown.push(`> 🟠 **Amis en commun :** \`${commonFriends.length}\` ami(s) partagé(s) ➔ **+20%**`);
                } else {
                    breakdown.push(`> 🟢 **Aucun ami en commun** ➔ **+0%**`);
                }

                // 3. Groupes en commun (surtout petits groupes)
                const targetGroupIds = new Set((targetGroups.data || []).map(g => g.group.id));
                const mainGroupIds = (mainGroups.data || []).map(g => g.group.id);
                const commonGroups = mainGroupIds.filter(id => targetGroupIds.has(id));

                if (commonGroups.length >= 2) {
                    matchScore += 25;
                    breakdown.push(`> 🔴 **Groupes partagés :** Présent dans \`${commonGroups.length}\` mêmes groupes ➔ **+25%**`);
                } else if (commonGroups.length === 1) {
                    matchScore += 15;
                    breakdown.push(`> 🟡 **Groupe partagé :** 1 groupe en commun ➔ **+15%**`);
                } else {
                    breakdown.push(`> 🟢 **Aucun groupe commun** ➔ **+0%**`);
                }

                const finalScore = Math.min(matchScore, 99);
                const progressBar = generateProgressBar(finalScore);

                let color = finalScore >= 60 ? '#ED4245' : (finalScore >= 30 ? '#F1C40F' : '#57F287');

                const compareEmbed = new EmbedBuilder()
                    .setTitle(`⚔️ DÉTECTION CROISÉE D'ALT — GURENKAI`)
                    .setColor(color)
                    .setDescription(
                        `Analyse de corrélation entre **@${targetUser.name}** (Suspect) et **@${mainUser.name}** (Main présumé)\n\n` +
                        `### 📊 Probabilité de Compte Lié / Alt\n` +
                        `> \`[${progressBar}]\` **${finalScore}%**\n\n` +
                        `### 🔬 Éléments de Preuve\n` +
                        `${breakdown.join('\n')}\n\n` +
                        `> 💡 **Verdict :** ${finalScore >= 60 ? '🚨 **Très forte probabilité que ces 2 comptes appartiennent à la même personne.**' : 'ℹ️ Pas assez d d\'éléments pour confirmer un lien direct.'}`
                    )
                    .setFooter({ text: 'Gurenkai Security • Analyse Croisée', iconURL: interaction.guild.iconURL() })
                    .setTimestamp();

                return interaction.editReply({ embeds: [compareEmbed] });

            } catch (err) {
                console.error(err);
                return interaction.editReply({ content: '❌ Erreur lors de l\'analyse croisée.' });
            }
        }

        // MODE 2 : ANALYSE SOLO AVANCÉE (Groupes + Badges + Réseau + Age)
        if (interaction.customId.startsWith('rblx_alt_')) {
            const userId = interaction.customId.replace('rblx_alt_', '');

            try {
                const [userData, friendsRes, followersRes, followingsRes, groupsRes, badgesRes] = await Promise.all([
                    fetch(`https://users.roblox.com/v1/users/${userId}`).then(r => r.json()),
                    fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`).then(r => r.json()),
                    fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`).then(r => r.json()),
                    fetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`).then(r => r.json()),
                    fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`).then(r => r.json()),
                    fetch(`https://badges.roblox.com/v1/users/${userId}/badges?limit=100`)
                ]);

                const friendsCount = friendsRes.count ?? 0;
                const followersCount = followersRes.count ?? 0;
                const followingsCount = followingsRes.count ?? 0;
                const groupsCount = groupsData.data ? groupsData.data.length : 0;
                const badgesCount = badgesData.data ? badgesData.data.length : 0;

                let riskScore = 0;
                const breakdown = [];

                // 1. ANCIENNETÉ DU COMPTE
                const createdDate = new Date(userData.created);
                const ageInDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

                if (ageInDays < 15) {
                    riskScore += 35;
                    breakdown.push(`> 🔴 **Ancienneté :** Créé il y a \`${ageInDays}j\` ➔ **+35%**`);
                } else if (ageInDays < 90) {
                    riskScore += 20;
                    breakdown.push(`> 🟠 **Ancienneté :** Récent (\`${ageInDays}j\`) ➔ **+20%**`);
                } else {
                    breakdown.push(`> 🟢 **Ancienneté :** Compte établi (\`${Math.floor(ageInDays / 365)} an(s)\`) ➔ **+0%**`);
                }

                // 2. ACTIVITÉ DE JEU (BADGES) — Crucial selon l'analyse
                if (badgesCount === 0) {
                    riskScore += 30;
                    breakdown.push(`> 🔴 **Badges Jeux :** Aucun badge débloqué (\`0\`) ➔ **+30%**`);
                } else if (badgesCount < 5) {
                    riskScore += 15;
                    breakdown.push(`> 🟡 **Badges Jeux :** Activité très faible (\`${badgesCount}\`) ➔ **+15%**`);
                } else {
                    breakdown.push(`> 🟢 **Badges Jeux :** Compte actif (\`${badgesCount}\` badges) ➔ **+0%**`);
                }

                // 3. GROUPES REJOINTS
                if (groupsCount === 0) {
                    riskScore += 20;
                    breakdown.push(`> 🔴 **Groupes :** Aucun groupe rejoint (\`0\`) ➔ **+20%**`);
                } else {
                    breakdown.push(`> 🟢 **Groupes :** Membre de \`${groupsCount}\` groupe(s) ➔ **+0%**`);
                }

                // 4. RÉSEAU SOCIAL (Amis / Abonnés)
                if (friendsCount <= 5 && followersCount === 0) {
                    riskScore += 20;
                    breakdown.push(`> 🔴 **Réseau Social :** Isolé (\`${friendsCount}\` amis, 0 abonné) ➔ **+20%**`);
                } else if (friendsCount <= 15) {
                    riskScore += 10;
                    breakdown.push(`> 🟡 **Réseau Social :** Réseau restreint (\`${friendsCount}\` amis) ➔ **+10%**`);
                } else {
                    breakdown.push(`> 🟢 **Réseau Social :** Solide (\`${friendsCount}\` amis) ➔ **+0%**`);
                }

                // 5. PATTERNS DE PSEUDO DE TROLL / ALT
                const trollRegex = /(alt|test|troll|user|guest|caca|pipi|fake|bot|suitoi|bellek|\d{5,})/i;
                if (trollRegex.test(userData.name) || trollRegex.test(userData.displayName || '')) {
                    riskScore += 15;
                    breakdown.push(`> ⚠️ **Nom / Pseudo :** Motif de pseudo suspect ➔ **+15%**`);
                }

                const finalScore = Math.min(riskScore, 99);
                const progressBar = generateProgressBar(finalScore);

                let riskLevel = finalScore >= 65 ? '🔴 **RISQUE ÉLEVÉ (Alt Très Probable)**' 
                    : (finalScore >= 35 ? '🟠 **RISQUE MODÉRÉ (Prudence)**' : '🟢 **FAIBLE RISQUE**');
                let color = finalScore >= 65 ? '#ED4245' : (finalScore >= 35 ? '#E67E22' : '#57F287');

                const auditEmbed = new EmbedBuilder()
                    .setTitle(`🛡️ AUDIT DE SÉCURITÉ ROBLOX — GURENKAI`)
                    .setColor(color)
                    .setDescription(
                        `Analyse du profil de **@${userData.name}** (\`${userId}\`)\n\n` +
                        `### 📊 Score de Suspicion d'Alt\n` +
                        `> ${riskLevel}\n` +
                        `> \`[${progressBar}]\` **${finalScore}%**\n\n` +
                        `### 🔬 Analyse Multi-Critères (Groupes, Badges, Réseau)\n` +
                        `${breakdown.join('\n')}`
                    )
                    .setFooter({ text: 'Gurenkai Security • Audit Éphémère', iconURL: interaction.guild.iconURL() })
                    .setTimestamp();

                return interaction.editReply({ embeds: [auditEmbed] });

            } catch (error) {
                console.error(error);
                return interaction.editReply({ content: '❌ Erreur lors de l\'analyse.' });
            }
        }
    }
};