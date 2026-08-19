// Security handling (mass-ban detection) has been moved to Lotus, which now
// handles it for this server (antiNuke.js, memberBan threshold). This event
// is kept as a no-op stub so the events loader doesn't error on a missing
// file — remove it entirely from the events folder if your loader tolerates
// that instead.
module.exports = {
    name: 'guildBanAdd',
    async execute(ban) {
        // Intentionally empty — see comment above.
    }
};
