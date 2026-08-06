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
    let disabled = loadDisabled();

    // 📋 Afficher la liste si l'option 'list' est choisie OU si aucun paramètre n'est fourni
    if (etat === 'list' || (!cmdName && !etat)) {
      return interaction.reply({
        content: disabled.length ? `🔒 **Commandes désactivées :**\n${disabled.map(c => `• /${c}`).join('\n')}` : '✅ **Aucune commande désactivée.**',
        ephemeral: true,
      });
    }

    // Si pas de commande spécifiée mais action Activer/Désactiver sélectionnée
    if (!cmdName) {
      return interaction.reply({ content: '❌ Tu dois préciser le nom d\'une commande à modifier.', ephemeral: true });
    }

    if (!interaction.client.commands.has(cmdName)) {
      return interaction.reply({ content: `❌ La commande /${cmdName} n'existe pas.`, ephemeral: true });
    }

    if (cmdName === 'togglecmd') {
      return interaction.reply({ content: `❌ Tu ne peux pas désactiver /togglecmd toi-même.`, ephemeral: true });
    }

    const shouldDisable = etat === 'disable' || (!etat && !disabled.includes(cmdName));

    if (shouldDisable) {
      if (!disabled.includes(cmdName)) disabled.push(cmdName);
      saveDisabled(disabled);
      return interaction.reply({ content: `🔒 /${cmdName} est maintenant **désactivée**.`, ephemeral: true });
    } else {
      disabled = disabled.filter(c => c !== cmdName);
      saveDisabled(disabled);
      return interaction.reply({ content: `🔓 /${cmdName} est maintenant **activée**.`, ephemeral: true });
    }
  },
};