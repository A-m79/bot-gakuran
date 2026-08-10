const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const Kos = require('../models/Kos');

function buildEmbed(entries) {
    const embed = new EmbedBuilder()
        .setTitle('🎯 KILL ON SIGHT — Gurenkai')
        .setColor('#FF0000')
        .setThumbnail('attachment://logo.png')
        .setFooter({ text: `Gurenkai • ${entries.length} cible(s) active(s)` })
        .setTimestamp();

    if (!entries || entries.length === 0) {
        embed.setDescription('> ✅ **Personne est sur la liste KOS.**');
        return embed;
    }

    const formattedList = entries.map((e, i) => 
        `**${i + 1}.** **\`${e.nom}\`**\n┗ 💬 *${e.raison}* — *(Ajouté par ${e.addedBy})*`
    ).join('\n\n');

    embed.setDescription(`⚠️ **Ces personnes/gangs sont à kill à vue :**\n\n${formattedList}`);
    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kos')
        .setDescription('🎯 Gérer la liste Kill On Sight')
        .addSubcommand(sub => sub
            .setName('ajouter')
            .setDescription('Ajouter ou modifier une cible KOS')
            .addStringOption(opt => opt.setName('nom').setDescription('Nom du joueur ou du groupe').setRequired(true))
            .addStringOption(opt => opt.setName('raison').setDescription('Raison du KOS').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('retirer')
            .setDescription('Retirer une cible de la liste')
            .addStringOption(opt => opt.setName('nom').setDescription('Nom exact de la cible à retirer').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const aLeGrade = interaction.member.roles.cache.some(r => (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim()).includes(r.id));
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        const sub = interaction.options.getSubcommand();
        
        let kosData = await Kos.findOne();
        if (!kosData) {
            kosData = new Kos({ messageId: null, entries: [] });
        }

        if (sub === 'ajouter') {
            const nom = interaction.options.getString('nom');
            const raison = interaction.options.getString('raison');
            
            const existingIdx = kosData.entries.findIndex(e => e.nom.toLowerCase() === nom.toLowerCase());
            if (existingIdx !== -1) {
                kosData.entries[existingIdx].raison = raison;
                kosData.entries[existingIdx].addedBy = interaction.user.username;
                kosData.entries[existingIdx].addedAt = new Date();
            } else {
                kosData.entries.push({ nom, raison, addedBy: interaction.user.username, addedAt: new Date() });
            }
        } else {
            const nom = interaction.options.getString('nom');
            const idx = kosData.entries.findIndex(e => e.nom.toLowerCase() === nom.toLowerCase());
            
            if (idx === -1) return interaction.editReply({ content: `❌ **${nom}** n'est pas dans la liste KOS.` });
            
            kosData.entries.splice(idx, 1);
        }

        // Forcer Mongoose à enregistrer les modifications
        kosData.markModified('entries');

        const embed = buildEmbed(kosData.entries);
        const logo = new AttachmentBuilder(path.join(__dirname, '..', 'logo.png'), { name: 'logo.png' });

        try {
            const channel = await interaction.client.channels.fetch(process.env.KOS_CHANNEL_ID);
            if (kosData.messageId) {
                try {
                    const msg = await channel.messages.fetch(kosData.messageId);
                    await msg.edit({ embeds: [embed], files: [logo] });
                } catch {
                    const newMsg = await channel.send({ embeds: [embed], files: [logo] });
                    kosData.messageId = newMsg.id;
                }
            } else {
                const newMsg = await channel.send({ embeds: [embed], files: [logo] });
                kosData.messageId = newMsg.id;
            }
            
            await kosData.save();
            await interaction.editReply({ content: `✅ Liste KOS mise à jour avec succès.` });
        } catch (e) {
            console.error('[KOS]', e);
            await interaction.editReply({ content: '❌ Erreur lors de la mise à jour.' });
        }
    }
};