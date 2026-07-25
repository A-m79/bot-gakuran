const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const Kos = require('../models/Kos');

function buildEmbed(entries) {
    const embed = new EmbedBuilder()
        .setTitle('🎯 KILL ON SIGHT — Gurenkai')
        .setColor('#CC0000')
        .setThumbnail('attachment://logo.png')
        .setFooter({ text: `Gurenkai • ${entries.length} cible(s)` })
        .setTimestamp();

    embed.setDescription(entries.length === 0
        ? '> ✅ Aucune cible sur la liste KOS.'
        : `**⚠️ Ces individus sont à éliminer à vue.**\n\n${entries.map((e, i) => `**${i+1}.** \`${e.nom}\`\n┗ *${e.raison}* — Ajouté par ${e.addedBy}`).join('\n\n')}`
    );
    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kos')
        .setDescription('🎯 Gérer la liste Kill On Sight')
        .addSubcommand(sub => sub
            .setName('ajouter')
            .setDescription('Ajouter une cible')
            .addStringOption(opt => opt.setName('nom').setDescription('Nom de la cible').setRequired(true))
            .addStringOption(opt => opt.setName('raison').setDescription('Raison du KOS').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('retirer')
            .setDescription('Retirer une cible')
            .addStringOption(opt => opt.setName('nom').setDescription('Nom exact à retirer').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const aLeGrade = interaction.member.roles.cache.some(r => (process.env.AUTHORIZED_ROLE_IDS || '').split(',').map(id => id.trim()).includes(r.id));
        if (!aLeGrade) return interaction.editReply({ content: "❌ Vous n'êtes pas autorisé à utiliser cette commande." });

        const sub = interaction.options.getSubcommand();
        
        // Récupération ou initialisation du document KOS unique dans MongoDB
        let kosData = await Kos.findOne();
        if (!kosData) {
            kosData = new Kos({ messageId: null, entries: [] });
        }

        if (sub === 'ajouter') {
            const nom = interaction.options.getString('nom');
            const raison = interaction.options.getString('raison');
            
            if (kosData.entries.find(e => e.nom.toLowerCase() === nom.toLowerCase()))
                return interaction.editReply({ content: `❌ **${nom}** est déjà sur la liste KOS.` });
            
            kosData.entries.push({ nom, raison, addedBy: interaction.user.username, addedAt: new Date() });
        } else {
            const nom = interaction.options.getString('nom');
            const idx = kosData.entries.findIndex(e => e.nom.toLowerCase() === nom.toLowerCase());
            
            if (idx === -1) return interaction.editReply({ content: `❌ **${nom}** n'est pas dans la liste KOS.` });
            
            kosData.entries.splice(idx, 1);
        }

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
            await interaction.editReply({ content: `✅ Liste KOS mise à jour.` });
        } catch (e) {
            console.error('[KOS]', e);
            await interaction.editReply({ content: '❌ Erreur lors de la mise à jour.' });
        }
    }
};