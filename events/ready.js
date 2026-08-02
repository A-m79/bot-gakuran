const giveawayModule = require('../commands/giveaway');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`\n⛩️  [V2] Bot Gurenkai connecté en tant que ${client.user.tag}`);
        console.log(`📋 ${client.commands.size} commande(s) chargée(s)\n`);
        
        client.user.setActivity('Gurenkai | Gang V2', { type: 3 });

        // Relance les giveaways en cours stockés sur MongoDB
        giveawayModule.checkOngoingGiveaways(client);
    },
};