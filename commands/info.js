const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('👤 Afficher les informations détaillées d\'un membre')
        .addUserOption(opt => opt.setName('membre').setDescription('Membre à inspecter').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const aLeGrade = interaction.member.roles.cache.some(r => (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim()).includes(r.id));
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        const user = interaction.options.getUser('membre');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.editReply({ content: '❌ Ce membre est introuvable sur le serveur.' });

        // Dates Discord (format automatique)
        const createdAt = `<t:${Math.floor(user.createdTimestamp / 1000)}:D> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`;
        const joinedAt  = member.joinedTimestamp
            ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`
            : 'Inconnu';

        // Rôles (sans @everyone, triés par position)
        const roles = member.roles.cache
            .filter(r => r.id !== interaction.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => r.toString());

        const roleStr = roles.length > 0
            ? roles.slice(0, 20).join(' ') + (roles.length > 20 ? ` *(+${roles.length - 20} autres)*` : '')
            : '*Aucun rôle*';

        // Couleur = couleur du rôle le plus haut (ou violet si défaut)
        const color = member.roles.highest.color || 0x5865F2;

        // Boost
        const boostStr = member.premiumSince
            ? `✅ Boost actif depuis <t:${Math.floor(member.premiumSinceTimestamp / 1000)}:D>`
            : '❌ Non';

        const embed = new EmbedBuilder()
            .setTitle(`👤 ${member.displayName}`)
            .setThumbnail(user.displayAvatarURL({ size: 256, extension: 'png' }))
            .setColor(color)
            .addFields(
                {
                    name: '🏷️ Identité',
                    value: `**Pseudo serveur :** ${member.displayName}\n**Tag Discord :** ${user.tag}\n**ID :** \`${user.id}\``,
                    inline: false
                },
                {
                    name: '📅 Dates',
                    value: `**Compte créé :** ${createdAt}\n**A rejoint :** ${joinedAt}`,
                    inline: false
                },
                {
                    name: `🎭 Rôles (${roles.length})`,
                    value: roleStr,
                    inline: false
                },
                { name: '👑 Rôle le plus haut', value: member.roles.highest.toString(), inline: true },
                { name: '🤖 Bot',               value: user.bot ? '✅ Oui' : '❌ Non',   inline: true },
                { name: '💎 Booster',           value: boostStr,                          inline: true },
            )
            .setFooter({ text: `Gurenkai • Demandé par ${interaction.user.username}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
