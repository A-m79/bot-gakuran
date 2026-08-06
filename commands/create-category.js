const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { hasAuthorizedRole } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create-category')
    .setDescription('[STAFF] Crée une catégorie avec un salon texte + vocal et des perms par rôle')
    .addStringOption(o => o.setName('nom').setDescription('Nom de la catégorie').setRequired(true))
    .addStringOption(o => o.setName('salon_texte').setDescription('Nom du salon texte').setRequired(true))
    .addStringOption(o => o.setName('salon_vocal').setDescription('Nom du salon vocal').setRequired(true))
    .addRoleOption(o => o.setName('role1').setDescription('Rôle autorisé').setRequired(true))
    .addRoleOption(o => o.setName('role2').setDescription('Rôle autorisé').setRequired(false))
    .addRoleOption(o => o.setName('role3').setDescription('Rôle autorisé').setRequired(false))
    .addRoleOption(o => o.setName('role4').setDescription('Rôle autorisé').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!hasAuthorizedRole(interaction)) {
      return interaction.reply({ content: '❌ Cette commande est réservée au staff autorisé.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const nom = interaction.options.getString('nom');
    const nomTexte = interaction.options.getString('salon_texte');
    const nomVocal = interaction.options.getString('salon_vocal');
    const roles = ['role1', 'role2', 'role3', 'role4']
      .map(k => interaction.options.getRole(k))
      .filter(Boolean);

    try {
      const overwrites = [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        ...roles.map(r => ({ id: r.id, allow: [PermissionFlagsBits.ViewChannel] })),
      ];

      const category = await interaction.guild.channels.create({
        name: nom,
        type: ChannelType.GuildCategory,
        permissionOverwrites: overwrites,
      });

      const textChannel = await interaction.guild.channels.create({
        name: nomTexte,
        type: ChannelType.GuildText,
        parent: category.id,
      });
      await textChannel.lockPermissions();

      const voiceChannel = await interaction.guild.channels.create({
        name: nomVocal,
        type: ChannelType.GuildVoice,
        parent: category.id,
      });
      await voiceChannel.lockPermissions();

      await interaction.editReply(
        `✅ Catégorie **${nom}** créée avec :\n` +
        `• 💬 #${textChannel.name}\n• 🔊 ${voiceChannel.name}\n` +
        `Accès : ${roles.map(r => r.name).join(', ')}`
      );
    } catch (err) {
      console.error(err);
      await interaction.editReply(`❌ Erreur : ${err.message}`);
    }
  },
};