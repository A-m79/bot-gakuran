const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const PERM_MAP = {
  voir: PermissionFlagsBits.ViewChannel,
  ecrire: PermissionFlagsBits.SendMessages,
  reagir: PermissionFlagsBits.AddReactions,
  historique: PermissionFlagsBits.ReadMessageHistory,
  fichiers: PermissionFlagsBits.AttachFiles,
  liens: PermissionFlagsBits.EmbedLinks,
  connect: PermissionFlagsBits.Connect,
  parler: PermissionFlagsBits.Speak,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchanperm')
    .setDescription('[STAFF] Modifie les perms d\'un salon précis pour un ou plusieurs rôles')
    .addChannelOption(o =>
      o.setName('salon')
        .setDescription('Le salon à modifier')
        .setRequired(true))
    .addStringOption(o =>
      o.setName('permission')
        .setDescription('Quelle permission modifier')
        .setRequired(true)
        .addChoices(
          { name: 'Voir le salon', value: 'voir' },
          { name: 'Écrire des messages', value: 'ecrire' },
          { name: 'Réagir', value: 'reagir' },
          { name: 'Voir l\'historique', value: 'historique' },
          { name: 'Envoyer des fichiers', value: 'fichiers' },
          { name: 'Intégrer des liens', value: 'liens' },
          { name: 'Se connecter (vocal)', value: 'connect' },
          { name: 'Parler (vocal)', value: 'parler' },
        ))
    .addStringOption(o =>
      o.setName('action')
        .setDescription('Autoriser, refuser, ou reset')
        .setRequired(true)
        .addChoices(
          { name: 'Autoriser', value: 'allow' },
          { name: 'Refuser', value: 'deny' },
          { name: 'Reset (neutre)', value: 'reset' },
        ))
    .addRoleOption(o => o.setName('role1').setDescription('Rôle concerné').setRequired(true))
    .addRoleOption(o => o.setName('role2').setDescription('Rôle concerné').setRequired(false))
    .addRoleOption(o => o.setName('role3').setDescription('Rôle concerné').setRequired(false))
    .addRoleOption(o => o.setName('role4').setDescription('Rôle concerné').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const authorizedIds = process.env.AUTHORIZED_ROLE_IDS.split(',');
    const isAuthorized = interaction.member.roles.cache.some(role => authorizedIds.includes(role.id));

    if (!isAuthorized) {
      return interaction.reply({ content: '❌ Cette commande est réservée au staff autorisé.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('salon');
    const permKey = interaction.options.getString('permission');
    const action = interaction.options.getString('action');

    const roles = ['role1', 'role2', 'role3', 'role4']
      .map(k => interaction.options.getRole(k))
      .filter(Boolean);

    const permFlag = PERM_MAP[permKey];
    const results = [];

    try {
      for (const role of roles) {
        if (action === 'reset') {
          const existing = channel.permissionOverwrites.cache.get(role.id);
          if (existing) {
            await existing.edit({ [Object.keys(PERM_MAP).find(k => PERM_MAP[k] === permFlag)]: null });
          }
          results.push(`⚪ **${role.name}** : reset sur "${permKey}"`);
        } else {
          await channel.permissionOverwrites.edit(role, {
            [permFlag]: action === 'allow',
          });
          results.push(`${action === 'allow' ? '✅' : '⛔'} **${role.name}** : ${permKey} → ${action === 'allow' ? 'autorisé' : 'refusé'}`);
        }
      }

      await interaction.editReply(
        `**Salon : #${channel.name}**\n${results.join('\n')}`
      );
    } catch (err) {
      console.error(err);
      await interaction.editReply(`❌ Erreur : ${err.message}`);
    }
  },
};