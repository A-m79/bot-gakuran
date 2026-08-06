const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const disabledPath = path.join(__dirname, '..', 'disabled-commands.json');

function loadDisabled() {
  if (!fs.existsSync(disabledPath)) fs.writeFileSync(disabledPath, '[]');
  return JSON.parse(fs.readFileSync(disabledPath, 'utf8'));
}

function saveDisabled(list) {
  fs.writeFileSync(disabledPath, JSON.stringify(list, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('togglecmd')
    .setDescription('[OWNER ONLY] Active ou désactive une commande du bot')
    .addStringOption(o =>
      o.setName('commande')
        .setDescription('Nom de la commande (sans le /)')
        .setRequired(true))
    .addStringOption(o =>
      o.setName('etat')
        .setDescription('Activer ou désactiver')
        .setRequired(true)
        .addChoices(
          { name: 'Désactiver', value: 'disable' },
          { name: 'Activer', value: 'enable' },
          { name: 'Voir la liste désactivée', value: 'list' },
        )),

  async execute(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({ content: '❌ Cette commande est réservée.', ephemeral: true });
    }

    const cmdName = interaction.options.getString('commande');
    const etat = interaction.options.getString('etat');
    let disabled = loadDisabled();

    if (etat === 'list') {
      return interaction.reply({
        content: disabled.length ? `🔒 Commandes désactivées :\n${disabled.map(c => `• /${c}`).join('\n')}` : '✅ Aucune commande désactivée.',
        ephemeral: true,
      });
    }

    if (etat === 'disable') {
      if (!interaction.client.commands.has(cmdName)) {
        return interaction.reply({ content: `❌ La commande /${cmdName} n'existe pas.`, ephemeral: true });
      }
      if (cmdName === 'togglecmd') {
        return interaction.reply({ content: `❌ Tu peux pas désactiver togglecmd toi-même, tu serais coincé.`, ephemeral: true });
      }
      if (!disabled.includes(cmdName)) disabled.push(cmdName);
      saveDisabled(disabled);
      return interaction.reply({ content: `🔒 /${cmdName} est maintenant **désactivée**.`, ephemeral: true });
    }

    if (etat === 'enable') {
      disabled = disabled.filter(c => c !== cmdName);
      saveDisabled(disabled);
      return interaction.reply({ content: `🔓 /${cmdName} est maintenant **activée**.`, ephemeral: true });
    }
  },
};