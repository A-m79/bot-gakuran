const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('🗑️ Supprimer un certain nombre de messages')
        .addIntegerOption(opt => opt
            .setName('nombre')
            .setDescription('Nombre de messages à supprimer (1-100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
        .addUserOption(opt => opt
            .setName('membre')
            .setDescription('Supprimer uniquement les messages de ce membre (optionnel)')
            .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const authorizedRoles = process.env.AUTHORIZED_ROLE_IDS?.split(',').map(id => id.trim()) || [];
        const aLeGrade = interaction.member.roles.cache.some(r => authorizedRoles.includes(r.id));
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        const nombre = interaction.options.getInteger('nombre');
        const cible  = interaction.options.getUser('membre');

        try {
            // Récupérer les messages
            const messages = await interaction.channel.messages.fetch({ limit: cible ? 100 : nombre });

            let toDelete = [...messages.values()];

            // Filtrer par membre si précisé
            if (cible) {
                toDelete = toDelete.filter(m => m.author.id === cible.id).slice(0, nombre);
            }

            // Discord ne peut supprimer en masse que les msgs de moins de 14 jours
            const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const recent = toDelete.filter(m => m.createdTimestamp > cutoff);
            const old    = toDelete.filter(m => m.createdTimestamp <= cutoff);

            let supprimés = 0;

            if (recent.length > 0) {
                if (recent.length === 1) {
                    await recent[0].delete();
                    supprimés += 1;
                } else {
                    const deleted = await interaction.channel.bulkDelete(recent, true);
                    supprimés += deleted.size;
                }
            }

            // Supprimer les vieux messages un par un
            for (const msg of old) {
                await msg.delete().catch(() => null);
                supprimés++;
            }

            const txt = cible
                ? `✅ **${supprimés}** message(s) de ${cible} supprimé(s).`
                : `✅ **${supprimés}** message(s) supprimé(s).`;

            await interaction.editReply({ content: txt });

        } catch (e) {
            console.error('[CLEAR]', e);
            await interaction.editReply({ content: '❌ Erreur lors de la suppression. Vérifie que le bot a la permission "Gérer les messages".' });
        }
    }
};
