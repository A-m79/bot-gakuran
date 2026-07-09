const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command) {
        commands.push(command.data.toJSON());
        console.log(`📦 /${command.data.name}`);
    }
}

const rest = new REST().setToken(process.env.TOKEN);

(async () => {
    try {
        console.log(`\n🔄 Déploiement de ${commands.length} commande(s)...`);
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('✅ Commandes déployées avec succès !');
    } catch (e) {
        console.error('❌ Erreur déploiement :', e);
    }
})();
