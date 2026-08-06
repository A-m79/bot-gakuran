const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { hasAuthorizedRole } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checksync')
    .setDescription('[STAFF] Vérifie quels salons ne sont pas synchronisés avec leur catégorie')
    .addChannelOption(o =>
      o.setName('categorie')
        .setDescription('Catégorie à vérifier (vide = toutes)')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!hasAuthorizedRole(interaction)) {
      return interaction.reply({ content: '❌ Cette commande est réservée au staff autorisé.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const targetCat = interaction.options.getChannel('categorie');
    const categories = targetCat
      ? [targetCat]
      : interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);

    let unsynced = [];
    for (const cat of categories.values ? categories.values() : categories) {
      const children = interaction.guild.channels.cache.filter(c => c.parentId === cat.id);
      children.forEach(ch => {
        if (!ch.permissionsLocked) unsynced.push(ch);
      });
    }

    if (unsynced.length === 0) {
      return interaction.editReply('✅ Tout est synchronisé, rien à faire.');
    }

    const list = unsynced.map(ch => `• ${ch.type === 2 ? '🔊' : '#'} ${ch.name} (dans **${ch.parent?.name}**)`).join('\n');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('sync_all')
        .setLabel('Tout synchroniser')
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await interaction.editReply({
      content: `⚠️ **${unsynced.length} salon(s) désynchronisé(s) :**\n${list}`,
      components: [row],
    });

    try {
      const confirm = await msg.awaitMessageComponent({
        time: 30000,
        filter: i => hasAuthorizedRole(i),
      });
      if (confirm.customId === 'sync_all') {
        await confirm.deferUpdate();
        for (const ch of unsynced) {
          await ch.lockPermissions();
        }
        await interaction.editReply({
          content: `✅ ${unsynced.length} salon(s) synchronisé(s) avec succès.`,
          components: [],
        });
      }
    } catch {
      await interaction.editReply({
        content: `${msg.content}\n\n⏱️ Temps écoulé, relance la commande si besoin.`,
        components: [],
      });
    }
  },
};