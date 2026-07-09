const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '..', 'data', 'kos.json');

function load() {
    if (!fs.existsSync(dataFile)) return { messageId: null, entries: [] };
    try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch (e) { return { messageId: null, entries: [] }; }
}

function save(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function buildEmbed(entries) {
    const embed = new EmbedBuilder()
        .setTitle('🎯 KILL ON SIGHT — GAKURAN')
        .setColor('#CC0000')
        .setThumbnail('attachment://logo.png')
        .setFooter({ text: `Gakuran Gang • ${entries.length} cible(s) enregistrée(s)` })
        .setTimestamp();

    if (entries.length === 0) {
        embed.setDescription('> ✅ Aucune cible sur la liste KOS pour le moment.');
    } else {
        const lines = entries.map((e, i) =>
            `**${i + 1}.** \`${e.nom}\`\n┗ *${e.raison}* — Ajouté par ${e.addedBy}`
        ).join('\n\n');
        embed.setDescription(`**⚠️ Ces individus sont à éliminer à vue. Aucune exception.**\n\n${lines}`);
    }

    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kos')
        .setDescription('🎯 Gérer la liste Kill On Sight du gang')
        .addSubcommand(sub => sub
            .setName('ajouter')
            .setDescription('Ajouter une cible à la liste KOS')
            .addStringOption(opt => opt.setName('nom').setDescription('Nom de la cible').setRequired(true))
            .addStringOption(opt => opt.setName('raison').setDescription('Raison du KOS').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('retirer')
            .setDescription('Retirer une cible de la liste KOS')
            .addStringOption(opt => opt.setName('nom').setDescription('Nom exact de la cible à retirer').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const aLeGrade = interaction.member.roles.cache.some(r => r.id === process.env.CHIEF_ROLE_ID);
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        const sub = interaction.options.getSubcommand();
        const data = load();

        if (sub === 'ajouter') {
            const nom = interaction.options.getString('nom');
            const raison = interaction.options.getString('raison');

            if (data.entries.find(e => e.nom.toLowerCase() === nom.toLowerCase())) {
                return interaction.editReply({ content: `❌ **${nom}** est déjà sur la liste KOS.` });
            }

            data.entries.push({
                nom, raison,
                addedBy: interaction.user.username,
                addedAt: new Date().toISOString()
            });

        } else if (sub === 'retirer') {
            const nom = interaction.options.getString('nom');
            const idx = data.entries.findIndex(e => e.nom.toLowerCase() === nom.toLowerCase());

            if (idx === -1) return interaction.editReply({ content: `❌ **${nom}** n'est pas dans la liste KOS.` });
            data.entries.splice(idx, 1);
        }

        // Envoyer ou update le message dans le salon KOS
        const embed = buildEmbed(data.entries);
        const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });

        try {
            const channel = await interaction.client.channels.fetch(process.env.KOS_CHANNEL_ID);

            if (data.messageId) {
                try {
                    const msg = await channel.messages.fetch(data.messageId);
                    await msg.edit({ embeds: [embed], files: [logo] });
                } catch {
                    const newMsg = await channel.send({ embeds: [embed], files: [logo] });
                    data.messageId = newMsg.id;
                }
            } else {
                const newMsg = await channel.send({ embeds: [embed], files: [logo] });
                data.messageId = newMsg.id;
            }

            save(data);

            const txt = sub === 'ajouter'
                ? `✅ **${interaction.options.getString('nom')}** ajouté à la liste KOS.`
                : `✅ **${interaction.options.getString('nom')}** retiré de la liste KOS.`;

            await interaction.editReply({ content: txt });

        } catch (e) {
            console.error('[KOS]', e);
            await interaction.editReply({ content: '❌ Erreur lors de la mise à jour de la liste KOS.' });
        }
    }
};
