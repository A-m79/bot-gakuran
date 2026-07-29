const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const Leaderboard = require('../models/Leaderboard');

// ─── HELPERS POUR COMPATIBILITÉ OBJECT / MAP MONGOOSE ───
function getRank(ranks, key) {
    if (!ranks) return null;
    const k = key.toString();
    if (ranks instanceof Map || typeof ranks.get === 'function') {
        return ranks.get(k);
    }
    return ranks[k];
}

function setRank(ranks, key, value) {
    if (!ranks) return;
    const k = key.toString();
    if (ranks instanceof Map || typeof ranks.set === 'function') {
        ranks.set(k, value);
    } else {
        ranks[k] = value;
    }
}

function getEntries(ranks) {
    if (!ranks) return [];
    if (ranks instanceof Map || typeof ranks.entries === 'function') {
        return Array.from(ranks.entries());
    }
    return Object.entries(ranks);
}

// Génération de l'embed visuel du classement
function buildLBEmbed(ranks) {
    let leaderboardText = '';
    
    for (let i = 1; i <= 10; i++) {
        const rankData = getRank(ranks, i) || { userId: null, style: 'Vide' };
        
        let emoji = '⚡';
        if (i === 1) emoji = '👑';
        else if (i === 2) emoji = '🥈';
        else if (i === 3) emoji = '🥉';
        else if (i <= 5) emoji = '🔥';

        const userMention = rankData.userId ? `<@${rankData.userId}>` : '*Place vacante*';
        const styleText = rankData.userId && rankData.style !== 'Vide' ? ` • \`${rankData.style}\`` : '';
        
        leaderboardText += `${emoji} **No.${i}** ─ ${userMention}${styleText}\n`;
        
        if (i === 5) {
            leaderboardText += '─'.repeat(22) + '\n';
        }
    }

    return new EmbedBuilder()
        .setTitle('🏆 CLASSEMENT OFFICIEL — GURENKAI')
        .setDescription(`Voici la hiérarchie actuelle des combattants de la Gurenkai.\n\n${leaderboardText}`)
        .setColor('#FF2A7A')
        .setThumbnail('attachment://logo.png')
        .setFooter({ text: 'Mise à jour automatique • Gurenkai' })
        .setTimestamp();
}

async function getLeaderboardDoc() {
    let lb = await Leaderboard.findOne();
    if (!lb) {
        const defaultRanks = {};
        for (let i = 1; i <= 10; i++) {
            defaultRanks[i.toString()] = { userId: null, style: 'Vide' };
        }
        lb = await Leaderboard.create({
            messageId: null,
            channelId: null,
            ranks: defaultRanks
        });
    }
    return lb;
}

// Mise à jour live de l'embed sur Discord
async function updateLiveEmbed(client, lbData) {
    if (!lbData.messageId || !lbData.channelId) {
        return { success: false, error: 'Message ID ou Channel ID non défini en base de données.' };
    }
    try {
        const channel = await client.channels.fetch(lbData.channelId);
        if (!channel) return { success: false, error: 'Salon introuvable.' };
        
        const message = await channel.messages.fetch(lbData.messageId);
        if (!message) return { success: false, error: 'Message du classement introuvable dans ce salon.' };

        const newEmbed = buildLBEmbed(lbData.ranks);
        
        // Édition simple de l'embed (Discord garde automatiquement logo.png déjà attaché)
        await message.edit({ embeds: [newEmbed] });
        return { success: true };
    } catch (e) {
        console.error('[ERREUR LB EDIT]', e);
        return { success: false, error: e.message || String(e) };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('🏆 Gérer le classement officiel (LB) du gang')
        .addSubcommand(sub => sub
            .setName('regles')
            .setDescription('Afficher le règlement complet du classement')
        )
        .addSubcommand(sub => sub
            .setName('setup')
            .setDescription('Poser un nouveau classement propre')
        )
        .addSubcommand(sub => sub
            .setName('connecter')
            .setDescription('Lier le bot à un message de classement existant via son ID')
            .addStringOption(opt => opt.setName('message_id').setDescription('L\'ID du message du classement').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('modifier')
            .setDescription('Attribuer un rang à un joueur (laisser vide pour libérer)')
            .addIntegerOption(opt => opt.setName('rang').setDescription('Le rang (1-10)').setRequired(true).setMinValue(1).setMaxValue(10))
            .addUserOption(opt => opt.setName('joueur').setDescription('Le joueur à placer').setRequired(false))
            .addStringOption(opt => opt.setName('style').setDescription('Style de combat').setRequired(false))
        )
        .addSubcommand(sub => sub
            .setName('inverser')
            .setDescription('Échanger les places de deux joueurs')
            .addUserOption(opt => opt.setName('joueur1').setDescription('Premier joueur').setRequired(true))
            .addUserOption(opt => opt.setName('joueur2').setDescription('Deuxième joueur').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const aLeGrade = interaction.member.roles.cache.some(r => (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim()).includes(r.id));
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        const sub = interaction.options.getSubcommand();

        if (sub === 'regles') {
            const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });

            const embed1 = new EmbedBuilder()
                .setTitle('🏆 CLASSEMENT OFFICIEL GURENKAI — RÈGLEMENT')
                .setColor('#FFD700')
                .setThumbnail('attachment://logo.png')
                .setDescription('>>> **Système mis en place par Tacos votre goat**\n\nLe classement (LB) sert à déterminer les meilleurs combattants du gang, du **No.10 au No.1**.')
                .addFields(
                    { name: '📥 1. COMMENT REJOINDRE LE CLASSEMENT', value: '• Pour intégrer le LB, tu dois DM un **Rank Manager** pour être ajouté à la file d\'attente des challengers.\n• Tu peux directement défier le **No.10** pour tenter de prendre sa place.\n• Une fois dans le classement, tu peux sauter des rangs pour défier qui tu veux, jusqu\'à ce que tu atteignes le **Top 5**.' },
                    { name: '👑 2. LE SAINT TOP 5', value: '• À partir du Top 5, il n\'est plus possible de sauter des rangs : **tu ne peux défier que la place juste au-dessus de toi**.' },
                    { name: '🛡️ 3. GRÂCE', value: '• Si tu défends ta place avec succès, tu obtiens une Grâce : **tu ne peux pas être défié pendant 24h**.' },
                    { name: '👤 4. ÉLIGIBILITÉ', value: '• Être un membre actif du gang Gurenkai. Aucun compte alt autorisé.' }
                );

            const embed2 = new EmbedBuilder()
                .setTitle('⚔️ RÈGLES DES COMBATS')
                .setColor('#FFD700')
                .addFields(
                    { name: '🥊 5. DÉROULEMENT', value: '• Cooldown de 48h après une défaite.\n• Format FT3 (3 rounds gagnants).\n• Présence obligatoire d\'un Rank Manager.' },
                    { name: '🚫 7. CONDUITE', value: '• Inactif 1 semaine = retrait du LB.\n• 5 forfaits cumulés = blacklist du LB 1 semaine.' }
                );

            const embed3 = new EmbedBuilder()
                .setTitle('⚙️ LITIGES & JEU')
                .setColor('#FFD700')
                .addFields(
                    { name: '🎮 8. JEU', value: '• Interdiction de changer de style en plein combat.\n• Cheat/Lag switch = ban permanent.' }
                )
                .setFooter({ text: 'Gurenkai • Respect, fun, et Puissance.' })
                .setTimestamp();

            await interaction.channel.send({ embeds: [embed1, embed2, embed3], files: [logo] });
            return interaction.editReply({ content: '✅ Règlement publié !' });
        }

        if (sub === 'setup') {
            await Leaderboard.deleteMany({});

            const defaultRanks = {};
            for (let i = 1; i <= 10; i++) {
                defaultRanks[i.toString()] = { userId: null, style: 'Vide' };
            }

            const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });
            const embed = buildLBEmbed(defaultRanks);

            const sentMsg = await interaction.channel.send({ embeds: [embed], files: [logo] });

            await Leaderboard.create({
                messageId: sentMsg.id,
                channelId: sentMsg.channelId,
                ranks: defaultRanks
            });

            return interaction.editReply({ content: `✅ Classement créé et connecté ! (ID Message : \`${sentMsg.id}\`)` });
        }

        if (sub === 'connecter') {
            const msgId = interaction.options.getString('message_id').trim();
            
            try {
                const targetMsg = await interaction.channel.messages.fetch(msgId);
                let lbData = await Leaderboard.findOne();
                if (!lbData) lbData = await getLeaderboardDoc();

                lbData.messageId = targetMsg.id;
                lbData.channelId = targetMsg.channelId;
                await lbData.save();

                const liveRes = await updateLiveEmbed(interaction.client, lbData);

                if (liveRes.success) {
                    return interaction.editReply({ content: `🔗 Bot connecté au message \`${msgId}\` et embed mis à jour en direct !` });
                } else {
                    return interaction.editReply({ content: `⚠️ Connecté à l'ID \`${msgId}\`, mais l'édition a échoué : \`${liveRes.error}\`` });
                }
            } catch (err) {
                return interaction.editReply({ content: `❌ Impossible de trouver le message avec l'ID \`${msgId}\` dans ce salon.` });
            }
        }

        const lbData = await getLeaderboardDoc();

        if (sub === 'modifier') {
            const rang = interaction.options.getInteger('rang').toString();
            const joueur = interaction.options.getUser('joueur');
            const style = interaction.options.getString('style') || 'Physique';

            if (!joueur) {
                setRank(lbData.ranks, rang, { userId: null, style: 'Vide' });
            } else {
                setRank(lbData.ranks, rang, { userId: joueur.id, style: style });
            }

            lbData.markModified('ranks');
            await lbData.save();

            const liveRes = await updateLiveEmbed(interaction.client, lbData);

            const messageRetour = joueur 
                ? `✅ Rang **No.${rang}** attribué à <@${joueur.id}> avec le style \`${style}\`.`
                : `✅ Rang **No.${rang}** vidé avec succès.`;

            const statusEmbed = liveRes.success 
                ? '\n🟢 Embed Discord mis à jour !' 
                : `\n⚠️ **Attention :** Modifié en BDD mais l'embed Discord n'a pas pu être édité. Raison: \`${liveRes.error}\``;

            return interaction.editReply({ content: messageRetour + statusEmbed });
        }

        if (sub === 'inverser') {
            const j1 = interaction.options.getUser('joueur1');
            const j2 = interaction.options.getUser('joueur2');

            let rangJ1 = null;
            let rangJ2 = null;

            const entries = getEntries(lbData.ranks);
            for (const [r, value] of entries) {
                if (value && value.userId === j1.id) rangJ1 = r;
                if (value && value.userId === j2.id) rangJ2 = r;
            }

            if (!rangJ1 || !rangJ2) {
                return interaction.editReply({ 
                    content: `❌ Impossible d'inverser. Les deux joueurs doivent déjà posséder un rang.\n• Rang de ${j1} : ${rangJ1 ? `No.${rangJ1}` : '**Non classé**'}\n• Rang de ${j2} : ${rangJ2 ? `No.${rangJ2}` : '**Non classé**'}` 
                });
            }

            const val1 = getRank(lbData.ranks, rangJ1);
            const val2 = getRank(lbData.ranks, rangJ2);

            setRank(lbData.ranks, rangJ1, { ...val2 });
            setRank(lbData.ranks, rangJ2, { ...val1 });

            lbData.markModified('ranks');
            await lbData.save();

            const liveRes = await updateLiveEmbed(interaction.client, lbData);

            const statusEmbed = liveRes.success 
                ? '\n🟢 Embed Discord mis à jour !' 
                : `\n⚠️ **Attention :** Modifié en BDD mais l'embed Discord n'a pas pu être édité. Raison: \`${liveRes.error}\``;

            return interaction.editReply({ 
                content: `🔄 Échange effectué avec succès !\n• <@${j1.id}> passe du rang **No.${rangJ1}** au **No.${rangJ2}**.\n• <@${j2.id}> passe du rang **No.${rangJ2}** au **No.${rangJ1}**.` + statusEmbed 
            });
        }
    }
};