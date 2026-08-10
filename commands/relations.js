const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const Relation = require('../models/Relation');

const TYPE_CONFIG = {
    allié:  { emoji: '🟢', label: 'ALLIÉS' },
    neutre: { emoji: '🟡', label: 'NEUTRES' },
    ennemi: { emoji: '🔴', label: 'ENNEMIS' },
};

function buildEmbed(entries) {
    const embed = new EmbedBuilder()
        .setTitle('🤝 RELATIONS — Gurenkai')
        .setColor('#00FFFF')
        .setThumbnail('attachment://logo.png')
        .setFooter({ text: 'Gurenkai • Diplomatie' })
        .setTimestamp();

    if (!entries || entries.length === 0) { 
        embed.setDescription('> *Aucune relation enregistrée pour le moment.*'); 
        return embed; 
    }

    let desc = '';
    for (const type of ['allié', 'neutre', 'ennemi']) {
        const group = entries.filter(e => e.type === type);
        if (!group.length) continue;
        const cfg = TYPE_CONFIG[type];
        
        desc += `\n**${cfg.emoji} ${cfg.label}**\n`;
        desc += group.map(e => {
            let line = `• **\`${e.nom}\`**`;
            if (e.lead) line += ` │ 👑 **Lead:** ${e.lead}`;
            if (e.discord) {
                const url = e.discord.startsWith('http') ? e.discord : `https://${e.discord}`;
                line += ` │ 🔗 [Discord](${url})`;
            }
            if (e.note) line += ` — *${e.note}*`;
            return line;
        }).join('\n') + '\n';
    }

    embed.setDescription(desc.trim() || '> *Aucune relation enregistrée.*');
    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('relations')
        .setDescription('🤝 Gérer les relations du gang')
        .addSubcommand(sub => sub
            .setName('ajouter')
            .setDescription('Ajouter ou modifier une relation')
            .addStringOption(opt => opt.setName('nom').setDescription('Nom du gang').setRequired(true))
            .addStringOption(opt => opt.setName('type').setDescription('Type de relation').setRequired(true)
                .addChoices(
                    { name: '🟢 Allié',            value: 'allié'  },
                    { name: '🟡 Pacte / Neutre',    value: 'neutre' },
                    { name: '🔴 Ennemi',           value: 'ennemi' },
                )
            )
            .addStringOption(opt => opt.setName('lead').setDescription('Lead(s) / Reps du gang (ex: @User)').setRequired(false))
            .addStringOption(opt => opt.setName('discord').setDescription('Lien d\'invitation de leur serveur Discord').setRequired(false))
            .addStringOption(opt => opt.setName('note').setDescription('Note complémentaire (optionnel)').setRequired(false))
        )
        .addSubcommand(sub => sub
            .setName('retirer')
            .setDescription('Retirer une relation')
            .addStringOption(opt => opt.setName('nom').setDescription('Nom exact du gang à retirer').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const aLeGrade = interaction.member.roles.cache.some(r => (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim()).includes(r.id));
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        const sub = interaction.options.getSubcommand();
        
        let relationData = await Relation.findOne();
        if (!relationData) {
            relationData = new Relation({ messageId: null, entries: [] });
        }

        if (sub === 'ajouter') {
            const nom = interaction.options.getString('nom');
            const type = interaction.options.getString('type');
            const lead = interaction.options.getString('lead') || '';
            const discord = interaction.options.getString('discord') || '';
            const note = interaction.options.getString('note') || '';

            const idx = relationData.entries.findIndex(e => e.nom.toLowerCase() === nom.toLowerCase());
            if (idx !== -1) { 
                relationData.entries[idx].type = type; 
                relationData.entries[idx].lead = lead; 
                relationData.entries[idx].discord = discord; 
                relationData.entries[idx].note = note; 
            } else {
                relationData.entries.push({ nom, type, lead, discord, note, addedBy: interaction.user.username });
            }
        } else {
            const nom = interaction.options.getString('nom');
            const idx = relationData.entries.findIndex(e => e.nom.toLowerCase() === nom.toLowerCase());
            if (idx === -1) return interaction.editReply({ content: `❌ **${nom}** n'est pas dans les relations.` });
            
            relationData.entries.splice(idx, 1);
        }

        // Forcer Mongoose à enregistrer les modifications dans le tableau
        relationData.markModified('entries');

        const embed = buildEmbed(relationData.entries);
        const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });

        try {
            const channel = await interaction.client.channels.fetch(process.env.RELATIONS_CHANNEL_ID);
            if (relationData.messageId) {
                try {
                    const msg = await channel.messages.fetch(relationData.messageId);
                    await msg.edit({ embeds: [embed], files: [logo] });
                } catch {
                    const newMsg = await channel.send({ embeds: [embed], files: [logo] });
                    relationData.messageId = newMsg.id;
                }
            } else {
                const newMsg = await channel.send({ embeds: [embed], files: [logo] });
                relationData.messageId = newMsg.id;
            }
            await relationData.save();
            await interaction.editReply({ content: `✅ Relations mises à jour avec succès.` });
        } catch (e) {
            console.error('[RELATIONS]', e);
            await interaction.editReply({ content: '❌ Erreur lors de la mise à jour.' });
        }
    }
};