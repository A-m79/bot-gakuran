const { SlashCommandBuilder } = require('discord.js');
const DisabledCommand = require('../models/DisabledCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('togglecmd')
    .setDescription('[OWNER ONLY] Active, désactive ou liste les commandes du bot')
    .addStringOption(o =>
      o.setName('commande')
        .setDescription('Nom de la commande (laisser vide pour voir la liste)')
        .setRequired(false))
    .addStringOption(o =>
      o.setName('etat')
        .setDescription('Activer, désactiver ou voir la liste')
        .setRequired(false)
        .addChoices(
          { name: 'Désactiver', value: 'disable' },
          { name: 'Activer', value: 'enable' },
          { name: 'Voir la liste désactivée', value: 'list' },
        )),

  async execute(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({ content: '❌ Cette commande est réservée.', ephemeral: true });
    }

    const cmdName = interaction.options.getString('commande')?.toLowerCase().trim();
    const etat = interaction.options.getString('etat');

    // 📋 Afficher la liste si 'list' ou si aucune option n'est entrée
    if (etat === 'list' || (!cmdName && !etat)) {
      const disabledDocs = await DisabledCommand.find({});
      const disabledList = disabledDocs.map(d => d.commandName);

      return interaction.reply({
        content: disabledList.length 
          ? `🔒 **Commandes désactivées :**\n${disabledList.map(c => `• /${c}`).join('\n')}` 
          : '✅ **Aucune commande désactivée.**',
        ephemeral: true,
      });
    }

    if (!cmdName) {
      return interaction.reply({ content: '❌ Tu dois préciser le nom d\'une commande à modifier.', ephemeral: true });
    }

    if (!interaction.client.commands.has(cmdName)) {
      return interaction.reply({ content: `❌ La commande /${cmdName} n'existe pas.`, ephemeral: true });
    }

    if (cmdName === 'togglecmd') {
      return interaction.reply({ content: `❌ Tu ne peux pas désactiver /togglecmd toi-même.`, ephemeral: true });
    }

    const existing = await DisabledCommand.findOne({ commandName: cmdName });
    const shouldDisable = etat === 'disable' || (!etat && !existing);

    if (shouldDisable) {
      if (!existing) {
        await DisabledCommand.create({ commandName: cmdName });
      }
      return interaction.reply({ content: `🔒 /${cmdName} est maintenant **désactivée**.`, ephemeral: true });
    } else {
      if (existing) {
        await DisabledCommand.deleteOne({ commandName: cmdName });
      }
      return interaction.reply({ content: `🔓 /${cmdName} est maintenant **activée**.`, ephemeral: true });
    }
  },
};