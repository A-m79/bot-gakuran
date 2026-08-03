const { EmbedBuilder } = require('discord.js');

// Mémoire temporaire pour mesurer le rythme des arrivées (Anti-Mass Join)
const recentJoins = [];
const RAID_THRESHOLD = 7;        // Nombre de membres max
const RAID_TIME_WINDOW = 10000;  // en millisecondes (10 secondes)
const MIN_ACCOUNT_AGE_DAYS = 3;  // Âge minimum du compte Discord (en jours)

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        const now = Date.now();
        const guild = member.guild;

        // Récupération du salon de logs de sécurité
        const logChannelId = process.env.SECURITY_LOGS_CHANNEL_ID?.trim();
        const logChannel = logChannelId ? await guild.channels.fetch(logChannelId).catch(() => null) : null;

        // ─── 1. VÉRIFICATION ÂGE DU COMPTE (ANTI-ALT RÉCENT) ───
        const accountAgeDays = (now - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);

        if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
            const ageInHours = Math.floor((now - member.user.createdTimestamp) / (1000 * 60 * 60));

            // Log d'avertissement au Staff
            if (logChannel) {
                const altAlertEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Alerte : Compte Très Récent / Suspicion d\'Alt')
                    .setColor('#FF9900')
                    .setDescription(`L'utilisateur ${member} (${member.user.tag}) vient de rejoindre le serveur, mais son compte est suspect.`)
                    .addFields(
                        { name: '👤 Utilisateur', value: `<@${member.id}> (\`${member.id}\`)`, inline: true },
                        { name: '⏳ Âge du compte', value: `\`${ageInHours} heure(s)\` (Seuil: ${MIN_ACCOUNT_AGE_DAYS}j)`, inline: true }
                    )
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                await logChannel.send({ embeds: [altAlertEmbed] }).catch(() => null);
            }

            // Optionnel : donner un rôle "Quarantaine" si tu en as un sur ton serveur
            const quarantineRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'quarantaine');
            if (quarantineRole) {
                await member.roles.add(quarantineRole).catch(() => null);
            }
        }

        // ─── 2. DÉTECTION ANTI-RAID (MASS JOIN) ───
        recentJoins.push(now);

        // Nettoyage des timestamps plus vieux que la fenêtre
        const joinsInWindow = recentJoins.filter(timestamp => now - timestamp < RAID_TIME_WINDOW);
        recentJoins.length = 0;
        recentJoins.push(...joinsInWindow);

        // Si le nombre d'arrivées dépasse le seuil
        if (joinsInWindow.length >= RAID_THRESHOLD) {
            console.warn(`[ANTI-RAID] 🚨 Raid détecté ! ${joinsInWindow.length} arrivées en ${RAID_TIME_WINDOW / 1000}s.`);

            if (logChannel) {
                const raidEmbed = new EmbedBuilder()
                    .setTitle('🚨 ALERTE ANTI-RAID DÉCLENCHÉE !')
                    .setColor('#FF0000')
                    .setDescription(`**Attaque / Mass-Join en cours !**\n\`${joinsInWindow.length}\` membres ont rejoint le serveur dans les dernières **${RAID_TIME_WINDOW / 1000} secondes**.\n\nLe Staff doit intervenir immédiatement !`)
                    .addFields(
                        { name: '👤 Dernier arrivant', value: `${member.user.tag} (\`${member.id}\`)` }
                    )
                    .setTimestamp();

                await logChannel.send({ 
                    content: '🚨 @everyone **SUSPICION DE RAID INTENSE EN COURS !**', 
                    embeds: [raidEmbed] 
                }).catch(() => null);
            }
        }
    }
};