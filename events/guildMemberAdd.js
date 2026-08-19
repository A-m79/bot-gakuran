// Security handling (raid detection, alt-account flagging) has been moved
// to Lotus, which now handles it for this server (antiRaid.js + altDetection.js).
// This event is kept as a no-op stub so the events loader doesn't error on a
// missing file — remove it entirely from the events folder if your loader
// tolerates that instead.
module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        // Intentionally empty — see comment above.
    }
};
