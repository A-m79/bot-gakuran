const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '..', 'data', 'leaderboard.json');

// Fonctions pour gérer le JSON
function loadLB() {
    if (!fs.existsSync(dataFile)) {
        const defaultLB = { messageId: null, channelId: null, ranks: {} };
        for (let i = 1; i <= 10; i++) defaultLB.ranks[i.toString()] = { userId: null, style: 'Vide' };
        return defaultLB;
    }
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function saveLB(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// Génération de l'embed visuel du classement
function buildLBEmbed(ranks) {
    let leaderboardText = '';
    
    for (let i = 1; i <= 10; i++) {
        const rankData = ranks[i.toString()] || { userId: null, style: 'Vide' };
        
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
            .setDescription('Poser le classement vide initial')
        )
        .addSubcommand(sub => sub
            .setName('modifier')
            .setDescription('Attribuer un rang à un joueur (laisser le joueur vide pour libérer la place)')
            .addIntegerOption(opt => opt.setName('rang').setDescription('Le rang (1-10)').setRequired(true).setMinValue(1).setMaxValue(10))
            .addUserOption(opt => opt.setName('joueur').setDescription('Le joueur à placer (ne rien mettre pour vider)').setRequired(false))
            .addStringOption(opt => opt.setName('style').setDescription('Style de combat du joueur').setRequired(false))
        )
        .addSubcommand(sub => sub
            .setName('inverser')
            .setDescription('Échanger les places de deux joueurs sur le classement')
            .addUserOption(opt => opt.setName('joueur1').setDescription('Premier joueur').setRequired(true))
            .addUserOption(opt => opt.setName('joueur2').setDescription('Deuxième joueur').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Vérification des permissions admin via .env
        const aLeGrade = interaction.member.roles.cache.some(r => (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim()).includes(r.id));
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        const sub = interaction.options.getSubcommand();
        const data = loadLB();

        // ─── 1️⃣ SOUSET-COMMANDE : REGLES (Envoi de tout ton pavé) ───
        if (sub === 'regles') {
            const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });

            const embed1 = new EmbedBuilder()
                .setTitle('🏆 CLASSEMENT OFFICIEL GURENKAI — RÈGLEMENT')
                .setColor('#FFD700')
                .setThumbnail('attachment://logo.png')
                .setDescription('>>> **Système inspiré du Leaderboard EU de Revengers Dream, adapté pour le gang.**\n\nLe classement (LB) sert à déterminer les meilleurs combattants du gang, du **No.10 au No.1**. C\'est un outil de prestige et de reconnaissance interne — pas un simple classement PvP random, chaque combat doit être encadré et respecté.')
                .addFields(
                    { name: '📥 1. COMMENT REJOINDRE LE CLASSEMENT', value: '• Pour intégrer le LB, tu dois DM un **Rank Manager** pour être ajouté à la file d\'attente des challengers.\n• Tu peux directement défier le **No.10** pour tenter de prendre sa place.\n• Une fois dans le classement, tu peux sauter des rangs pour défier qui tu veux, jusqu\'à ce que tu atteignes le **Top 5**.' },
                    { name: '👑 2. LE SAINT TOP 5', value: '• À partir du Top 5, il n\'est plus possible de sauter des rangs : **tu ne peux défier que la place juste au-dessus de toi**.\n• Tu peux aussi défier une place en dessous de toi (pour le fun / garder la forme) : si l\'adversaire gagne, il prend ta place.' },
                    { name: '🛡️ 3. GRÂCE (Protection après défense)', value: '• Si tu défends ta place avec succès (tu gagne contre un challenger), tu obtiens une Grâce : **tu ne peux pas être défié pendant 24h**.' },
                    { name: '👤 4. CONDITIONS D\'ÉLIGIBILITÉ', value: '• Être membre actif reconnu du gang Gurenkai.\n• Ancienneté minimum sur le serveur Discord du gang : à définir par les Rank Managers (ex : 2-4 semaines).\n• **Un seul compte par joueur** : les alts sont strictement interdits sous peine de ban du LB.' }
                );

            const embed2 = new EmbedBuilder()
                .setTitle('⚔️ RÈGLES DES COMBATS & CONDUITE')
                .setColor('#FFD700')
                .addFields(
                    { name: '🥊 5. RÈGLES DE DÉROULEMENT DES COMBATS', value: '1️⃣ **Cooldown de 48h** avant de pouvoir redéfier quelqu\'un qui t\'a battu.\n2️⃣ Tu peux combattre **2 personnes différentes maximum par jour**.\n3️⃣ Format de match : **premier à 3 rounds gagnants (FT3)**, pour tous les rangs.\n4️⃣ Le combat doit se dérouler dans le **chat de groupe LB dédié**, jamais en privé.\n5️⃣ Après un défi, l\'adversaire a **1 jour de délai pour accepter**. Passé ce délai, le combat doit être accepté le jour 2, sinon **échange automatique des places**.\n6️⃣ Le No.1 peut aussi être défié (cooldown 48h).' },
                    { name: '🚫 7. RÈGLES DE CONDUITE DIRECTES', value: '• Casser une règle de match = défaite directe + possible blacklist.\n• Quitter en plein combat = forfait (sauf accord adverse).\n• Inactif sur le LB pendant 1 semaine = blacklist temporaire de 3 jours.\n• Interdiction d\'extorsion, de spam, de toxicité ou de désinformation.\n• **5 forfaits cumulés** = blacklist d\'une semaine.' }
                );

            const embed3 = new EmbedBuilder()
                .setTitle('⚙️ RÈGLES SPÉCIFIQUES & LITIGES')
                .setColor('#FFD700')
                .addFields(
                    { name: '🎮 8. RÈGLES SPÉCIFIQUES AU JEU', value: '1️⃣ Changer de stats/skills/style en plein combat interdit.\n2️⃣ Hack, bug abuse, lag switch = ban permanent du LB.\n3️⃣ Objets donnant un bonus de stats interdits.\n4️⃣ Auras/effets cosmétiques donnant un avantage interdits.' },
                    { name: '🎥 9. PREUVES ET LITIGES', value: '• Tout signalement pour non-respect des règles doit être accompagné d\'une **preuve (vidéo/replay)**.\n• Sans preuve vidéo concernant un litige, les Rank Managers ne modifieront pas le classement. Enregistrez vos combats !' }
                )
                .setFooter({ text: 'Gurenkai • Respect, Discipline, Puissance.' })
                .setTimestamp();

            await interaction.channel.send({
                embeds: [embed1, embed2, embed3],
                files: [logo]
            });

            return interaction.editReply({ content: '✅ Règlement officiel publié avec succès !' });
        }

        // ─── 2️⃣ SOUS-COMMANDE : SETUP (Pose le classement) ───
        if (sub === 'setup') {
            const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });
            const embed = buildLBEmbed(data.ranks);

            const sentMsg = await interaction.channel.send({
                embeds: [embed],
                files: [logo]
            });

            data.messageId = sentMsg.id;
            data.channelId = sentMsg.channelId;
            saveLB(data);

            return interaction.editReply({ content: '✅ Classement vide initialisé dans ce salon !' });
        }

        // ─── 3️⃣ SOUS-COMMANDE : MODIFIER (Met un joueur ou vide la place) ───
        if (sub === 'modifier') {
            const rang = interaction.options.getInteger('rang').toString();
            const joueur = interaction.options.getUser('joueur');
            const style = interaction.options.getString('style') || 'Physique';

            if (!joueur) {
                // Si pas de joueur -> On remet la place à vide !
                data.ranks[rang] = { userId: null, style: 'Vide' };
            } else {
                data.ranks[rang] = { userId: joueur.id, style: style };
            }

            saveLB(data);
            await updateLiveEmbed(interaction.client, data);

            const messageRetour = joueur 
                ? `✅ Rang **No.${rang}** attribué à <@${joueur.id}> avec le style \`${style}\`.`
                : `✅ Rang **No.${rang}** vidé avec succès.`;

            return interaction.editReply({ content: messageRetour });
        }

        // ─── 4️⃣ SOUS-COMMANDE : INVERSER (Le swap magique entre deux joueurs) ───
        if (sub === 'inverser') {
            const j1 = interaction.options.getUser('joueur1');
            const j2 = interaction.options.getUser('joueur2');

            let rangJ1 = null;
            let rangJ2 = null;

            // On cherche leurs rangs actuels
            for (const [r, value] of Object.entries(data.ranks)) {
                if (value.userId === j1.id) rangJ1 = r;
                if (value.userId === j2.id) rangJ2 = r;
            }

            if (!rangJ1 || !rangJ2) {
                return interaction.editReply({ 
                    content: `❌ Impossible d'inverser. Les deux joueurs doivent déjà posséder un rang.\n• Rang de ${j1} : ${rangJ1 ? `No.${rangJ1}` : '**Non classé**'}\n• Rang de ${j2} : ${rangJ2 ? `No.${rangJ2}` : '**Non classé**'}\n\n*Note : S'ils ne sont pas classés, utilisez d'abord \`/leaderboard modifier\` pour les ajouter.*` 
                });
            }

            // Swap des données dans l'objet
            const temp = { ...data.ranks[rangJ1] };
            data.ranks[rangJ1] = { ...data.ranks[rangJ2] };
            data.ranks[rangJ2] = temp;

            saveLB(data);
            await updateLiveEmbed(interaction.client, data);

            return interaction.editReply({ 
                content: `🔄 Échange effectué avec succès !\n• <@${j1.id}> passe du rang **No.${rangJ1}** au **No.${rangJ2}**.\n• <@${j2.id}> passe du rang **No.${rangJ2}** au **No.${rangJ1}**.` 
            });
        }
    }
};

// Fonction interne pour actualiser instantanément l'embed d'affichage
async function updateLiveEmbed(client, data) {
    if (!data.messageId || !data.channelId) return;
    try {
        const channel = await client.channels.fetch(data.channelId);
        const message = await channel.messages.fetch(data.messageId);
        const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });
        const newEmbed = buildLBEmbed(data.ranks);
        await message.edit({ embeds: [newEmbed], files: [logo] });
    } catch (e) {
        console.error('[ERREUR MISE A JOUR LB LIVE]', e.message);
    }
}