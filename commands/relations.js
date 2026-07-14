const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '..', 'data', 'relations.json');

function load() {
    if (!fs.existsSync(dataFile)) return { messageId: null, entries: [] };
    try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch (e) { return { messageId: null, entries: [] }; }
}
function save(data) { fs.writeFileSync(dataFile, JSON.stringify(data, null, 2)); }

const TYPE_CONFIG = {
    allié:  { emoji: '🟢', label: 'ALLIÉS'    },
    neutre: { emoji: '🟡', label: 'NEUTRES'   },
    ennemi: { emoji: '🔴', label: 'ENNEMIS'   },
    guerre: { emoji: '💀', label: 'EN GUERRE' },
};

function buildEmbed(entries) {
    const embed = new EmbedBuilder()
        .setTitle('🤝 RELATIONS DIPLOMATIQUES — FUKUSHŪ NO SEIEI')
        .setColor('#4A90D9')
        .setThumbnail('attachment://logo.png')
        .setFooter({ text: 'Fukushū no Seiei • Diplomatie' })
        .setTimestamp();

    if (entries.length === 0) { embed.setDescription('> Aucune relation enregistrée.'); return embed; }

    let desc = '';
    for (const type of ['allié','neutre','ennemi','guerre']) {
        const group = entries.filter(e => e.type === type);
        if (!group.length) continue;
        const cfg = TYPE_CONFIG[type];
        desc += `\n**${cfg.emoji} ${cfg.label}**\n`;
        desc += group.map(e => `• \`${e.nom}\`${e.note ? ` — *${e.note}*` : ''}`).join('\n');
        desc += '\n';
    }
    embed.setDescription(desc.trim());
    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('relations')
        .setDescription('🤝 Gérer les relations diplomatiques du gang')
        .addSubcommand(sub => sub
            .setName('ajouter')
            .setDescription('Ajouter ou modifier une relation')
            .addStringOption(opt => opt.setName('nom').setDescription('Nom du gang').setRequired(true))
            .addStringOption(opt => opt.setName('type').setDescription('Type de relation').setRequired(true)
                .addChoices(
                    { name: '🟢 Allié',     value: 'allié'  },
                    { name: '🟡 Neutre',    value: 'neutre' },
                    { name: '🔴 Ennemi',    value: 'ennemi' },
                    { name: '💀 En guerre', value: 'guerre' },
                )
            )
            .addStringOption(opt => opt.setName('note').setDescription('Note (optionnel)').setRequired(false))
        )
        .addSubcommand(sub => sub
            .setName('retirer')
            .setDescription('Retirer une relation')
            .addStringOption(opt => opt.setName('nom').setDescription('Nom exact du gang').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const aLeGrade = interaction.member.roles.cache.some(r => (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim()).includes(r.id));
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        const sub  = interaction.options.getSubcommand();
        const data = load();

        if (sub === 'ajouter') {
            const nom  = interaction.options.getString('nom');
            const type = interaction.options.getString('type');
            const note = interaction.options.getString('note') || '';
            const idx  = data.entries.findIndex(e => e.nom.toLowerCase() === nom.toLowerCase());
            if (idx !== -1) { data.entries[idx].type = type; data.entries[idx].note = note; }
            else data.entries.push({ nom, type, note, addedBy: interaction.user.username });
        } else {
            const nom = interaction.options.getString('nom');
            const idx = data.entries.findIndex(e => e.nom.toLowerCase() === nom.toLowerCase());
            if (idx === -1) return interaction.editReply({ content: `❌ **${nom}** n'est pas dans les relations.` });
            data.entries.splice(idx, 1);
        }

        const embed = buildEmbed(data.entries);
        const logo  = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });

        try {
            const channel = await interaction.client.channels.fetch(process.env.RELATIONS_CHANNEL_ID);
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
            await interaction.editReply({ content: `✅ Relations mises à jour.` });
        } catch (e) {
            console.error('[RELATIONS]', e);
            await interaction.editReply({ content: '❌ Erreur lors de la mise à jour.' });
        }
    }
};
