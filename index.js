const { Client, GatewayIntentBits, Collection, EmbedBuilder, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ─── SERVEUR HTTP (nécessaire pour Render / hébergement 24h/24) ───
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ Bot Gakuran en ligne !'));
app.listen(PORT, () => console.log(`🌐 Serveur HTTP actif sur le port ${PORT}`));

// ─── BOT DISCORD ───
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`✅ Commande chargée : /${command.data.name}`);
    }
}

client.once('ready', () => {
    console.log(`\n⛩️  Bot connecté en tant que ${client.user.tag}`);
    console.log(`📋 ${client.commands.size} commande(s) chargée(s)\n`);
    client.user.setActivity('Gakuran | Gang', { type: 3 });
});

// ─── ACTIVITY CHECK — Suivi des réactions ───
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.partial) {
        try { await reaction.fetch(); } catch (e) { return; }
    }
    if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch (e) { return; }
    }

    if (reaction.emoji.name !== '✅') return;

    const checkFile = path.join(__dirname, 'data', 'activitycheck.json');
    if (!fs.existsSync(checkFile)) return;

    let checks;
    try { checks = JSON.parse(fs.readFileSync(checkFile, 'utf8')); } catch (e) { return; }

    const check = checks.find(c => c.messageId === reaction.message.id && !c.reached);
    if (!check) return;

    const users = await reaction.users.fetch();
    const humanCount = users.filter(u => !u.bot).size;

    if (humanCount >= check.objectif) {
        check.reached = true;
        fs.writeFileSync(checkFile, JSON.stringify(checks, null, 2));

        try {
            const channel = await client.channels.fetch(check.channelId);
            const successEmbed = new EmbedBuilder()
                .setTitle('🎉 OBJECTIF ATTEINT — GAKURAN')
                .setDescription(`**${humanCount} membre(s)** ont répondu présent !\n\n> La guilde est mobilisée. Bien joué à tous ! 🔥`)
                .setColor('#00FF88')
                .addFields(
                    { name: '🎯 Objectif fixé',    value: `${check.objectif} réactions`, inline: true },
                    { name: '✅ Réponses reçues',  value: `${humanCount} membres`,        inline: true },
                )
                .setFooter({ text: 'Gakuran Gang • Activity Check' })
                .setTimestamp();

            await channel.send({
                content: '🎊 **Objectif atteint !** @everyone',
                embeds: [successEmbed],
                allowedMentions: { parse: ['everyone'] }
            });
        } catch (e) {
            console.error('[ACTIVITY CHECK]', e.message);
        }
    }
});

// ─── HANDLER COMMANDES ───
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);

        // Logs
        const logChannelId = process.env.LOGS_CHANNEL_ID?.trim();
        if (logChannelId) {
            try {
                const logChannel = await client.channels.fetch(logChannelId);
                if (logChannel) {
                    let optsText = '';
                    interaction.options.data.forEach(opt => {
                        if (opt.options) {
                            opt.options.forEach(sub => { optsText += `• **${sub.name}** : ${sub.value}\n`; });
                        } else {
                            optsText += `• **${opt.name}** : ${opt.value}\n`;
                        }
                    });

                    const logEmbed = new EmbedBuilder()
                        .setTitle('📥 Log de Commande — Gakuran')
                        .setColor('#FFD700')
                        .setDescription(`**${interaction.user.tag}** a exécuté une commande.`)
                        .addFields(
                            { name: '👤 Utilisateur', value: `<@${interaction.user.id}>`,  inline: true },
                            { name: '💻 Commande',    value: `\`/${interaction.commandName}\``, inline: true },
                            { name: '📍 Salon',       value: `<#${interaction.channelId}>`, inline: true },
                            { name: '📋 Données',     value: optsText || '_Aucune option_', inline: false }
                        )
                        .setTimestamp();

                    await logChannel.send({ embeds: [logEmbed] });
                }
            } catch (e) {
                console.error('[LOGS]', e.message);
            }
        }

    } catch (error) {
        console.error(`❌ Erreur /${interaction.commandName} :`, error);
        const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(msg);
        } else {
            await interaction.reply(msg);
        }
    }
});

client.login(process.env.TOKEN);
