require('dotenv').config();
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');

// ─── CONNEXION MONGODB ───
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ─── CLIENT DISCORD ───
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates, // 👈 Ajouté pour détecter les entrées/sorties vocales
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// ─── SERVEUR HTTP (Health Check honnête, basé sur l'état réel du bot) ───
const app = express();
const PORT = process.env.PORT || 3000;

// Route pour UptimeRobot — répond toujours 200, sert juste à empêcher le sleep de Render
app.get('/', (req, res) => {
    res.status(200).send('✅ Bot Gurenkai V2 Online!');
});

// Route dédiée au vrai statut du bot — utilisée par le Health Check Path de Render
app.get('/health', (req, res) => {
    if (client.isReady()) {
        res.status(200).send('✅ Bot connecté à Discord');
    } else {
        // 503 = Render considère le service en échec et le redémarre automatiquement
        res.status(503).send('⚠️ Bot déconnecté de Discord (gateway down)');
    }
});

app.listen(PORT, () => console.log(`🌐 HTTP Server running on port ${PORT}`));

client.commands = new Collection();

// ─── CHARGEMENT DES COMMANDES ───
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// ─── CHARGEMENT AUTOMATIQUE DES ÉVÉNEMENTS (EVENT HANDLER) ───
// Chaque event est isolé dans un try/catch : si UN event throw une erreur,
// ça n'affecte plus que lui, le bot entier ne crash plus.
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));

    const safeExecute = async (...args) => {
        try {
            await event.execute(...args, client);
        } catch (err) {
            console.error(`❌ Erreur non gérée dans l'event "${event.name}" (fichier: ${file}) :`, err);
        }
    };

    if (event.once) {
        client.once(event.name, safeExecute);
    } else {
        client.on(event.name, safeExecute);
    }
    console.log(`⚙️ Événement chargé : ${event.name}`);
}

// ─── MONITORING DE LA CONNEXION GATEWAY (diagnostic déconnexions) ───
client.on('shardDisconnect', (event, shardId) => {
    console.warn(`⚠️ Shard ${shardId} déconnecté — Code: ${event.code}, Raison: ${event.reason}`);
});

client.on('shardReconnecting', (shardId) => {
    console.log(`🔄 Shard ${shardId} tente de se reconnecter...`);
});

client.on('shardResume', (shardId, replayedEvents) => {
    console.log(`✅ Shard ${shardId} reconnecté avec succès (${replayedEvents} events rejoués)`);
});

client.on('shardError', (error, shardId) => {
    console.error(`❌ Erreur sur le shard ${shardId} :`, error);
});

// ─── FILETS DE SÉCURITÉ GLOBAUX ───
// Empêche le process de crash sur des erreurs vraiment imprévues
client.on('error', (err) => {
    console.error('❌ Erreur client Discord :', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Promesse rejetée non gérée :', err);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Exception non capturée :', err);
});

client.login(process.env.TOKEN);