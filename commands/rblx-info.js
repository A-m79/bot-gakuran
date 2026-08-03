const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');

// ─── CLÉ API OPEN CLOUD (à mettre dans les variables d'env de Render) ───
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

// ─── CACHE MÉMOIRE AVEC AUTO-PURGE ───
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            cache.delete(key);
        }
    }
}, 10 * 60 * 1000);

// ─── FETCH INTEL / RETRY SYSTEM ───
async function fetchWithRetry(url, options = {}, retries = 2, backoff = 1000) {
    const isGet = !options.method || options.method === 'GET';
    if (isGet && cache.has(url)) {
        const cached = cache.get(url);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
    }

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        ...(options.headers || {})
    };

    const fetchOptions = { ...options, headers };

    try {
        const response = await fetch(url, fetchOptions);

        if (response.status === 429 && retries > 0) {
            await new Promise(res => setTimeout(res, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }

        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status} sur ${url}`);
        }

        const data = await response.json();

        if (isGet) {
            cache.set(url, { timestamp: Date.now(), data });
        }

        return data;

    } catch (err) {
        if (err.message.startsWith('HTTP Error') || retries <= 0) {
            throw err;
        }
        await new Promise(res => setTimeout(res, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
}

// Helper pour extraire la valeur d'une promesse Settled
function getSettledValue(result) {
    return result.status === 'fulfilled' ? result.value : null;
}

// ─── FONCTIONS UTILITAIRES ───
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

// ─── BADGES VIA OPEN CLOUD (remplace l'ancien badges.roblox.com bloqué en 401) ───

// Récupère les badges d'un utilisateur avec leur date d'obtention précise (addTime)
async function getUserBadgesWithDates(userId) {
    const url = `https://apis.roblox.com/cloud/v2/users/${userId}/inventory-items?filter=badges=true&maxPageSize=100`;

    const data = await fetchWithRetry(url, {
        headers: { 'x-api-key': ROBLOX_API_KEY }
    });

    return (data.inventoryItems || []).map(item => ({
        badgeId: String(item.badgeDetails.badgeId),
        addTime: item.addTime
    }));
}

// Récupère le nom lisible d'un badge (endpoint public, pas besoin de clé API)
async function getBadgeName(badgeId) {
    try {
        const data = await fetchWithRetry(`https://badges.roblox.com/v1/badges/${badgeId}`);
        return data.displayName || data.name || `Badge #${badgeId}`;
    } catch (e) {
        return `Badge #${badgeId}`;
    }
}

// Compare les badges de 2 comptes avec timing précis (Open Cloud)
async function compareBadges(targetId, mainId) {
    try {
        const [targetBadges, mainBadges] = await Promise.all([
            getUserBadgesWithDates(targetId),
            getUserBadgesWithDates(mainId)
        ]);

        const mainBadgeMap = new Map(mainBadges.map(b => [b.badgeId, b.addTime]));
        const commonBadgesRaw = [];

        for (const badge of targetBadges) {
            if (mainBadgeMap.has(badge.badgeId)) {
                const t1 = new Date(badge.addTime).getTime();
                const t2 = new Date(mainBadgeMap.get(badge.badgeId)).getTime();
                const diffMinutes = Math.abs(t1 - t2) / (1000 * 60);
                commonBadgesRaw.push({ badgeId: badge.badgeId, diffMinutes });
            }
        }

        // Récupère les noms en parallèle, uniquement pour les badges communs trouvés
        const commonBadges = await Promise.all(
            commonBadgesRaw.map(async b => ({
                ...b,
                name: await getBadgeName(b.badgeId)
            }))
        );

        return commonBadges;
    } catch (e) {
        console.error('[ERREUR COMPARAISON BADGES]', e);
        return [];
    }
}

// ─── COMMANDE DISCORD ───
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
                .setDescription('Optionnel : Pseudo du Main suspecté (pour analyse croisée)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const username = interaction.options.getString('username');
        const mainUsername = interaction.options.getString('compte_principal');

        try {
            const searchData = await fetchWithRetry('https://users.roblox.com/v1/usernames/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
            });

            if (!searchData.data || searchData.data.length === 0) {
                return interaction.editReply({ content: `❌ **Utilisateur introuvable** : Impossible de trouver \`${username}\`.` });
            }

            const targetUser = searchData.data[0];

            // Requéte principale (Profil basique)
            const userRes = await fetchWithRetry(`https://users.roblox.com/v1/users/${targetUser.id}`);

            // Requêtes secondaires exécutées en parallèle avec Promise.allSettled
            const settledResults = await Promise.allSettled([
                fetchWithRetry(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${targetUser.id}&size=420x420&format=Png&isCircular=false`),
                fetchWithRetry(`https://friends.roblox.com/v1/users/${targetUser.id}/friends/count`),
                fetchWithRetry(`https://friends.roblox.com/v1/users/${targetUser.id}/followers/count`),
                fetchWithRetry('https://presence.roblox.com/v1/presence/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userIds: [targetUser.id] })
                }),
                fetchWithRetry(`https://groups.roblox.com/v1/users/${targetUser.id}/groups/roles`),
                getUserBadgesWithDates(targetUser.id) // ← Open Cloud maintenant
            ]);

            const avatarRes = getSettledValue(settledResults[0]);
            const friendsRes = getSettledValue(settledResults[1]);
            const followersRes = getSettledValue(settledResults[2]);
            const presenceRes = getSettledValue(settledResults[3]);
            const groupsRes = getSettledValue(settledResults[4]);
            const badgesList = getSettledValue(settledResults[5]); // tableau direct, pas de .data

            const friendsCount = friendsRes?.count ?? 0;
            const followersCount = followersRes?.count ?? 0;
            const groupsCount = groupsRes?.data ? groupsRes.data.length : 0;

            const badgesCount = badgesList ? (badgesList.length >= 100 ? '100+' : badgesList.length) : '🔒 Non accessible';

            const displayName = userRes.displayName || userRes.name;
            const description = (userRes.description && userRes.description.trim() !== '') ? userRes.description : 'Aucune description.';
            const createdTimestamp = Math.floor(new Date(userRes.created).getTime() / 1000);
            const avatarUrl = avatarRes?.data?.[0]?.imageUrl || null;
            const isBanned = userRes.isBanned ? '🔴 **Banni**' : '🟢 **Actif**';

            let presenceStatus = '⚪ **Hors ligne**';
            if (presenceRes?.userPresences?.[0]) {
                const type = presenceRes.userPresences[0].userPresenceType;
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
                    `> 📛 **Display Name :** \`${displayName}\`\n` +
                    `> 🏷️ **Username :** \`@${userRes.name}\`\n` +
                    `> 🆔 **ID Roblox :** \`${userRes.id}\`\n` +
                    `> 🌐 **Activité :** ${presenceStatus}\n` +
                    `> 🛡️ **Statut :** ${isBanned}\n` +
                    `> 📅 **Création :** <t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)\n\n` +
                    `### 📊 Statistiques & Activité Jeux\n` +
                    `> 👥 **Amis :** \`${friendsCount}\` | 📡 **Abonnés :** \`${followersCount}\`\n` +
                    `> 🏰 **Groupes rejoints :** \`${groupsCount}\`\n` +
                    `> 🏅 **Badges débloqués :** \`${badgesCount}\`\n\n` +
                    `### 📝 Bio / Description\n` +
                    `\`\`\`text\n${description.length > 250 ? description.substring(0, 250) + '...' : description}\n\`\`\``
                )
                .setFooter({ text: 'Gurenkai V2 • Roblox Intelligence', iconURL: interaction.guild.iconURL() })
                .setTimestamp();

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
            return interaction.editReply({ content: `❌ **Erreur système** : Impossible de trouver cet utilisateur Roblox.` });
        }
    },

    async handleButton(interaction) {
        await interaction.deferReply();

        // ─── MODE 1 : ANALYSE CROISÉE (Alt vs Main) ───
        if (interaction.customId.startsWith('rblx_compare_')) {
            const parts = interaction.customId.split('_');
            const targetId = parts[2];
            const mainUsername = decodeURIComponent(parts[3]);

            try {
                const mainSearch = await fetchWithRetry('https://users.roblox.com/v1/usernames/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usernames: [mainUsername], excludeBannedUsers: false })
                });
                const mainData = mainSearch.data?.[0];

                if (!mainData) {
                    return interaction.editReply({ content: `❌ Impossible de trouver le compte principal \`${mainUsername}\`.` });
                }

                const [targetUser, mainUser] = await Promise.all([
                    fetchWithRetry(`https://users.roblox.com/v1/users/${targetId}`),
                    fetchWithRetry(`https://users.roblox.com/v1/users/${mainData.id}`)
                ]);

                const settledComparisons = await Promise.allSettled([
                    fetchWithRetry(`https://friends.roblox.com/v1/users/${targetId}/friends`),
                    fetchWithRetry(`https://friends.roblox.com/v1/users/${mainData.id}/friends`),
                    fetchWithRetry(`https://groups.roblox.com/v1/users/${targetId}/groups/roles`),
                    fetchWithRetry(`https://groups.roblox.com/v1/users/${mainData.id}/groups/roles`)
                ]);

                const targetFriends = getSettledValue(settledComparisons[0]);
                const mainFriends = getSettledValue(settledComparisons[1]);
                const targetGroups = getSettledValue(settledComparisons[2]);
                const mainGroups = getSettledValue(settledComparisons[3]);

                let matchScore = 0;
                const breakdown = [];

                // 1. Similarité Pseudos
                const simScore = calculateSimilarity(targetUser.name, mainUser.name);
                if (simScore >= 70) {
                    matchScore += 25;
                    breakdown.push(`> 🔴 **Pseudos presque identiques :** \`${simScore}%\` de similarité ➔ **+25%**`);
                } else if (simScore >= 40) {
                    matchScore += 15;
                    breakdown.push(`> 🟠 **Pseudos similaires :** \`${simScore}%\` de similarité ➔ **+15%**`);
                } else {
                    breakdown.push(`> 🟢 **Pseudos différents :** \`${simScore}%\` de similarité ➔ **+0%**`);
                }

                // 2. Amis en Commun
                const targetFriendsIds = new Set((targetFriends?.data || []).map(f => f.id));
                const mainFriendsIds = (mainFriends?.data || []).map(f => f.id);
                const commonFriends = mainFriendsIds.filter(id => targetFriendsIds.has(id));

                if (commonFriends.length >= 5) {
                    matchScore += 25;
                    breakdown.push(`> 🔴 **Réseau commun massif :** \`${commonFriends.length}\` amis en commun ➔ **+25%**`);
                } else if (commonFriends.length >= 1) {
                    matchScore += 15;
                    breakdown.push(`> 🟠 **Amis en commun :** \`${commonFriends.length}\` ami(s) partagé(s) ➔ **+15%**`);
                } else {
                    breakdown.push(`> 🟢 **Aucun ami en commun** ➔ **+0%**`);
                }

                // 3. Groupes en Commun
                const targetGroupIds = new Set((targetGroups?.data || []).map(g => g.group.id));
                const mainGroupIds = (mainGroups?.data || []).map(g => g.group.id);
                const commonGroups = mainGroupIds.filter(id => targetGroupIds.has(id));

                if (commonGroups.length >= 2) {
                    matchScore += 15;
                    breakdown.push(`> 🔴 **Groupes partagés :** Présent dans \`${commonGroups.length}\` mêmes groupes ➔ **+15%**`);
                } else if (commonGroups.length === 1) {
                    matchScore += 10;
                    breakdown.push(`> 🟡 **Groupe partagé :** 1 groupe en commun ➔ **+10%**`);
                } else {
                    breakdown.push(`> 🟢 **Aucun groupe commun** ➔ **+0%**`);
                }

                // 4. Badges en Commun (via Open Cloud, avec timing précis)
                const commonBadges = await compareBadges(targetId, mainData.id);
                if (commonBadges.length > 0) {
                    const closeInTime = commonBadges.filter(b => b.diffMinutes < 60);

                    if (closeInTime.length >= 1) {
                        matchScore += 40;
                        breakdown.push(`> 🔴 **Badges à timestamp proche (<1h) :** \`${closeInTime.length}\` badge(s) (ex: "${closeInTime[0].name}" à ${Math.round(closeInTime[0].diffMinutes)}m d'écart) ➔ **+40%**`);
                    } else {
                        matchScore += 20;
                        breakdown.push(`> 🟡 **Badges de jeux en commun :** \`${commonBadges.length}\` badge(s) partagé(s) ➔ **+20%**`);
                    }
                } else {
                    breakdown.push(`> 🟢 **Aucun badge commun** ➔ **+0%**`);
                }

                const finalScore = Math.min(matchScore, 99);
                const progressBar = generateProgressBar(finalScore);

                let color = finalScore >= 60 ? '#ED4245' : (finalScore >= 35 ? '#F1C40F' : '#57F287');

                const compareEmbed = new EmbedBuilder()
                    .setTitle(`⚔️ DÉTECTION CROISÉE D'ALT — GURENKAI`)
                    .setColor(color)
                    .setDescription(
                        `Analyse de corrélation entre **@${targetUser.name}** (Suspect) et **@${mainUser.name}** (Main présumé)\n\n` +
                        `### 📊 Probabilité de Compte Lié / Alt\n` +
                        `> \`[${progressBar}]\` **${finalScore}%**\n\n` +
                        `### 🔬 Éléments de Preuve\n` +
                        `${breakdown.join('\n')}\n\n` +
                        `> 💡 **Verdict :** ${finalScore >= 60 ? '🚨 **Très forte probabilité que ces 2 comptes appartiennent à la même personne.**' : 'ℹ️ Pas assez d\'éléments pour confirmer un lien direct.'}`
                    )
                    .setFooter({ text: 'Gurenkai Security • Analyse Croisée', iconURL: interaction.guild.iconURL() })
                    .setTimestamp();

                return interaction.editReply({ embeds: [compareEmbed] });

            } catch (err) {
                console.error(err);
                return interaction.editReply({ content: `❌ Erreur lors de l'analyse croisée.` });
            }
        }

        // ─── MODE 2 : ANALYSE SOLO ───
        if (interaction.customId.startsWith('rblx_alt_')) {
            const userId = interaction.customId.replace('rblx_alt_', '');

            try {
                const userData = await fetchWithRetry(`https://users.roblox.com/v1/users/${userId}`);

                const settledAudit = await Promise.allSettled([
                    fetchWithRetry(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
                    fetchWithRetry(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
                    fetchWithRetry(`https://groups.roblox.com/v1/users/${userId}/groups/roles`),
                    getUserBadgesWithDates(userId) // ← Open Cloud maintenant
                ]);

                const friendsRes = getSettledValue(settledAudit[0]);
                const followersRes = getSettledValue(settledAudit[1]);
                const groupsRes = getSettledValue(settledAudit[2]);
                const badgesList = getSettledValue(settledAudit[3]); // tableau direct

                const friendsCount = friendsRes?.count ?? 0;
                const followersCount = followersRes?.count ?? 0;
                const groupsCount = groupsRes?.data ? groupsRes.data.length : 0;
                const badgesCount = badgesList ? badgesList.length : null;

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

                // 2. ACTIVITÉ DE JEU (BADGES)
                if (badgesCount === null) {
                    breakdown.push(`> 🔒 **Badges Jeux :** Non accessible ➔ **+0%**`);
                } else if (badgesCount === 0) {
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

                // 4. RÉSEAU SOCIAL
                if (friendsCount <= 5 && followersCount === 0) {
                    riskScore += 20;
                    breakdown.push(`> 🔴 **Réseau Social :** Isolé (\`${friendsCount}\` amis, 0 abonné) ➔ **+20%**`);
                } else if (friendsCount <= 15) {
                    riskScore += 10;
                    breakdown.push(`> 🟡 **Réseau Social :** Réseau restreint (\`${friendsCount}\` amis) ➔ **+10%**`);
                } else {
                    breakdown.push(`> 🟢 **Réseau Social :** Solide (\`${friendsCount}\` amis) ➔ **+0%**`);
                }

                // 5. PATTERNS DE PSEUDOS TROLL / ALT
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
                    .setFooter({ text: 'Gurenkai Security • Audit Public', iconURL: interaction.guild.iconURL() })
                    .setTimestamp();

                return interaction.editReply({ embeds: [auditEmbed] });

            } catch (error) {
                console.error(error);
                return interaction.editReply({ content: `❌ Erreur lors de l'analyse.` });
            }
        }
    }
};