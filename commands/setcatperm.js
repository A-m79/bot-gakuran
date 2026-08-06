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
  gerer_msg: PermissionFlagsBits.ManageMessages,
  mentionner_everyone: PermissionFlagsBits.MentionEveryone,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setcatperm')
    .setDescription('[STAFF] Modifie les perms d\'une catégorie pour un ou plusieurs rôles')
    .addChannelOption(o =>
      o.setName('categorie')
        .setDescription('La catégorie à modifier')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildCategory))
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
          { name: 'Gérer les messages', value: 'gerer_msg' },
          { name: 'Mentionner @everyone', value: 'mentionner_everyone' },
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
    .addBooleanOption(o =>
      o.setName('sync_direct')
        .setDescription('Synchroniser direct les salons enfants après modif ? (défaut: non)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const authorizedIds = process.env.AUTHORIZED_ROLE_IDS.split(',');
    const isAuthorized = interaction.member.roles.cache.some(role => authorizedIds.includes(role.id));

    if (!isAuthorized) {
      return interaction.reply({ content: '❌ Cette commande est réservée au staff autorisé.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const category = interaction.options.getChannel('categorie');
    const permKey = interaction.options.getString('permission');
    const action = interaction.options.getString('action');
    const syncDirect = interaction.options.getBoolean('sync_direct') ?? false;

    const roles = ['role1', 'role2', 'role3', 'role4']
      .map(k => interaction.options.getRole(k))
      .filter(Boolean);

    const permFlag = PERM_MAP[permKey];
    const results = [];

    try {
      for (const role of roles) {
        if (action === 'reset') {
          const existing = category.permissionOverwrites.cache.get(role.id);
          if (existing) {
            await existing.edit({ [Object.keys(PERM_MAP).find(k => PERM_MAP[k] === permFlag)]: null });
          }
          results.push(`⚪ **${role.name}** : reset sur "${permKey}"`);
        } else {
          await category.permissionOverwrites.edit(role, {
            [permFlag]: action === 'allow',
          });
          results.push(`${action === 'allow' ? '✅' : '⛔'} **${role.name}** : ${permKey} → ${action === 'allow' ? 'autorisé' : 'refusé'}`);
        }
      }

      let syncMsg = '';
      if (syncDirect) {
        const children = interaction.guild.channels.cache.filter(c => c.parentId === category.id);
        for (const ch of children.values()) {
          await ch.lockPermissions();
        }
        syncMsg = `\n🔄 ${children.size} salon(s) enfant(s) synchronisé(s).`;
      } else {
        syncMsg = `\n⚠️ Pense à synchroniser les salons enfants (ou relance avec \`sync_direct: Oui\`).`;
      }

      await interaction.editReply(
        `**Catégorie : ${category.name}**\n${results.join('\n')}${syncMsg}`
      );
    } catch (err) {
      console.error(err);
      await interaction.editReply(`❌ Erreur : ${err.message}`);
    }
  },
};