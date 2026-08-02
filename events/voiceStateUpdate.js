const { ChannelType, PermissionFlagsBits } = require('discord.js');

// Garde la trace des salons temporaires créés
const tempChannels = new Set();

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        const hubChannelId = process.env.HUB_VOICE_CHANNEL_ID;
        if (!hubChannelId) return;

        // ─── 1. REJOINT LE SALON HUB ───
        if (newState.channelId === hubChannelId) {
            const guild = newState.guild;
            const member = newState.member;
            const parentCategory = newState.channel.parentId;

            try {
                // Création du salon temporaire avec permissions pour le proprio
                const tempChannel = await guild.channels.create({
                    name: `🔊 Salon de ${member.displayName}`,
                    type: ChannelType.GuildVoice,
                    parent: parentCategory || null,
                    reason: 'Salon vocal éphémère — Gurenkai V2',
                    permissionOverwrites: [
                        {
                            id: member.id, // Le proprio du salon
                            allow: [
                                PermissionFlagsBits.ManageChannels, // Modifier le nom, limite d'utilisateurs, etc.
                                PermissionFlagsBits.MoveMembers,     // Expulser/déplacer des gens
                                PermissionFlagsBits.MuteMembers,     // Muter des personnes dans le vocal
                                PermissionFlagsBits.DeafenMembers,   // Mettre en sourdine
                            ],
                        },
                    ],
                });

                // On mémorise l'ID du salon
                tempChannels.add(tempChannel.id);

                // Déplacement immédiat du membre
                await member.voice.setChannel(tempChannel);
            } catch (err) {
                console.error('❌ Erreur création vocal éphémère :', err);
            }
        }

        // ─── 2. QUITTE UN SALON TEMPORAIRE ───
        if (oldState.channelId && oldState.channelId !== newState.channelId) {
            const oldChannel = oldState.channel;

            // Si c'est un salon éphémère et qu'il est vide, on le supprime
            if (oldChannel && tempChannels.has(oldChannel.id) && oldChannel.members.size === 0) {
                tempChannels.delete(oldChannel.id);
                await oldChannel.delete('Salon éphémère vide').catch(() => null);
            }
        }
    }
};