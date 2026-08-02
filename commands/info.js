const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');

const BADGES = {
    Staff: '🛠️ Staff Discord',
    Partner: '👑 Partenaire Discord',
    Hypesquad: '🎉 HypeSquad Events',
    BugHunterLevel1: '🐛 Bug Hunter (Niv. 1)',
    BugHunterLevel2: '🐛 Bug Hunter (Niv. 2)',
    HypeSquadOnlineHouse1: '🏠 HypeSquad Bravery',
    HypeSquadOnlineHouse2: '🏠 HypeSquad Brilliance',
    HypeSquadOnlineHouse3: '🏠 HypeSquad Balance',
    PremiumEarlySupporter: '💎 Soutien de la première heure',
    VerifiedDeveloper: '👨‍💻 Développeur de bot vérifié',
    ActiveDeveloper: '⚡ Développeur actif',
    CertifiedModerator: '🛡️ Modérateur certifié'
};

const KEY_PERMISSIONS = [
    { flag: PermissionFlagsBits.Administrator, label: '👑 Administrateur' },
    { flag: PermissionFlagsBits.ManageGuild, label: '⚙️ Gérer le serveur' },
    { flag: PermissionFlagsBits.ManageRoles, label: '🎭 Gérer les rôles' },
    { flag: PermissionFlagsBits.ManageChannels, label: '📁 Gérer les salons' },
    { flag: PermissionFlagsBits.KickMembers, label: '👢 Expulser' },
    { flag: PermissionFlagsBits.BanMembers, label: '🔨 Bannir' },
    { flag: PermissionFlagsBits.ModerateMembers, label: '🔇 Exclure (Timeout)' },
    { flag: PermissionFlagsBits.ManageMessages, label: '💬 Gérer les messages' },
    { flag: PermissionFlagsBits.MentionEveryone, label: '📢 Mentionner @everyone' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('👤 Afficher les informations détaillées et l\'activité d\'un membre')
        .addUserOption(opt => opt
            .setName('membre')
            .setDescription('Membre à inspecter (laisser vide pour voir votre profil)')
            .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('membre') || interaction.user;
        const user = await targetUser.fetch(true).catch(() => targetUser);
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            return interaction.editReply({ content: '❌ Ce membre n\'est plus présent sur ce serveur.' });
        }

        // --- 1. BADGES DISCORD ---
        const userFlags = user.flags ? user.flags.toArray() : [];
        const badgesList = userFlags.map(flag => BADGES[flag]).filter(Boolean);
        const badgesStr = badgesList.length > 0 ? badgesList.join(' • ') : '*Aucun badge spécial*';

        // --- 2. DATES ---
        const createdAt = `<t:${Math.floor(user.createdTimestamp / 1000)}:f> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`;
        const joinedAt = member.joinedTimestamp
            ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:f> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`
            : '*Inconnu*';

        // --- 3. RÔLES ---
        const roles = member.roles.cache
            .filter(r => r.id !== interaction.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => r.toString());

        const roleStr = roles.length > 0
            ? (roles.length > 15 ? roles.slice(0, 15).join(' ') + ` *(+${roles.length - 15} autres)*` : roles.join(' '))
            : '*Aucun rôle*';

        // --- 4. PERMISSIONS CLÉS ---
        let keyPermsList = [];
        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            keyPermsList = ['👑 **Administrateur (Toutes les permissions)**'];
        } else {
            keyPermsList = KEY_PERMISSIONS
                .filter(p => member.permissions.has(p.flag))
                .map(p => p.label);
        }
        const keyPermsStr = keyPermsList.length > 0 ? keyPermsList.join(' • ') : '*Aucune permission clé*';

        // --- 5. ACTIVITÉS / PRÉSENCE (Custom Status, Jeux, Spotify, Stream) ---
        const presence = member.presence;
        let activityDetails = [];
        let statusEmoji = '⚪ Hors-ligne';

        if (presence) {
            if (presence.status === 'online') statusEmoji = '🟢 En ligne';
            else if (presence.status === 'idle') statusEmoji = '🌙 Inactif';
            else if (presence.status === 'dnd') statusEmoji = '🔴 Ne pas déranger';

            presence.activities.forEach(act => {
                // Statut personnalisé (Emoji + Texte)
                if (act.type === ActivityType.Custom) {
                    const emoji = act.emoji ? `${act.emoji.name} ` : '';
                    const text = act.state ? `"${act.state}"` : '';
                    if (emoji || text) activityDetails.push(`💭 **Statut :** ${emoji}${text}`);
                }
                // Spotify
                else if (act.name === 'Spotify') {
                    activityDetails.push(`🎵 **Écoute Spotify :** [${act.details}] de *${act.state}*`);
                }
                // Streaming (Twitch / YouTube)
                else if (act.type === ActivityType.Streaming) {
                    activityDetails.push(`🎥 **En Live :** [${act.details || act.name}](${act.url})`);
                }
                // Jeux vidéo
                else if (act.type === ActivityType.Playing) {
                    activityDetails.push(`🎮 **Joue à :** ${act.name}`);
                }
                // Écoute / Regarde autre chose
                else if (act.type === ActivityType.Watching) {
                    activityDetails.push(`📺 **Regarde :** ${act.name}`);
                }
            });
        }

        const activityStr = activityDetails.length > 0 
            ? activityDetails.join('\n') 
            : '*Aucune activité détectée actuellement*';

        // --- 6. AUTRES STATUTS (Timeout, Vocal, Booster) ---
        const isTimedOut = member.isCommunicationDisabled();
        const timeoutStr = isTimedOut
            ? `⚠️ **En exclusion jusqu'à :** <t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:f>`
            : '🟢 Aucun timeout';

        const voiceChannel = member.voice.channel ? `<#${member.voice.channel.id}>` : '❌ Non connecté';
        const boostStr = member.premiumSince
            ? `💎 **Booster depuis :** <t:${Math.floor(member.premiumSinceTimestamp / 1000)}:D>`
            : '❌ Ne booste pas';

        // --- 7. VISUELS ---
        const embedColor = member.roles.highest.color || user.accentColor || 0xFF2A7A;
        const avatarUrl = member.displayAvatarURL({ size: 512, extension: 'png' });
        const bannerUrl = user.bannerURL({ size: 1024, extension: 'png' });

        const embed = new EmbedBuilder()
            .setTitle(`👤 Profil de ${member.displayName}`)
            .setDescription(`**Mention :** <@${user.id}>\n**ID :** \`${user.id}\``)
            .setThumbnail(avatarUrl)
            .setColor(embedColor)
            .addFields(
                {
                    name: '🏷️ Identité Discord',
                    value: `**Nom d'utilisateur :** \`${user.username}\`\n**Badges :** ${badgesStr}\n**Compte Bot :** ${user.bot ? '✅ Oui' : '❌ Non'}`,
                    inline: false
                },
                {
                    name: '📡 Présence & Activité En Direct',
                    value: `**Statut :** ${statusEmoji}\n${activityStr}`,
                    inline: false
                },
                {
                    name: '📅 Horodatages',
                    value: `**Création du compte :** ${createdAt}\n**Arrivée sur le serveur :** ${joinedAt}`,
                    inline: false
                },
                {
                    name: `🎭 Rôles (${roles.length})`,
                    value: `**Plus haut rôle :** ${member.roles.highest}\n${roleStr}`,
                    inline: false
                },
                {
                    name: '🔑 Permissions Notables',
                    value: keyPermsStr,
                    inline: false
                },
                {
                    name: '🌐 Statut Serveur',
                    value: `**Serveur :** ${boostStr}\n**Salon vocal :** ${voiceChannel}\n**Modération :** ${timeoutStr}`,
                    inline: false
                }
            )
            .setFooter({ text: `Gurenkai • Demandé par ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        if (bannerUrl) {
            embed.setImage(bannerUrl);
        }

        await interaction.editReply({ embeds: [embed] });
    }
};