const axios = require('axios');

exports.handler = async function (event, context) {
    try {
        console.log("Fetching fresh data from Sportradar...");
        const today = new Date().toISOString().split('T')[0];
        const url = `https://lsc.fn.sportradar.com/common/en/Etc:UTC/gismo/sport_matches/21/${today}`;

        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Origin': 'https://sportcenter.sir.sportradar.com',
                'Referer': 'https://sportcenter.sir.sportradar.com/'
            }
        });

        const fetchedMatches = [];
        if (data && data.doc && data.doc.length > 0) {
            const matchesData = data.doc[0].data;
            const matches = matchesData.matches || {};

            Object.values(matches).forEach(m => {
                const isLive = m.status && m.status.name === "Live";
                let statusText = m.status ? m.status.name : "Scheduled";

                if (m.result && m.result.home !== undefined) {
                    statusText = `${m.result.home} - ${m.result.away}`;
                }

                const t1Name = m.teams && m.teams.home ? m.teams.home.name : "Team 1";
                const t2Name = m.teams && m.teams.away ? m.teams.away.name : "Team 2";
                const t1Uid = m.teams && m.teams.home ? m.teams.home.uid : null;
                const t2Uid = m.teams && m.teams.away ? m.teams.away.uid : null;

                const t1Logo = t1Uid ? `https://img.sportradar.com/ls/crest/big/${t1Uid}.png` : `https://placehold.co/152x152?text=${encodeURIComponent(t1Name.charAt(0))}`;
                const t2Logo = t2Uid ? `https://img.sportradar.com/ls/crest/big/${t2Uid}.png` : `https://placehold.co/152x152?text=${encodeURIComponent(t2Name.charAt(0))}`;

                let seriesName = "Cricket Match";
                if (m._tid && matchesData.tournaments && matchesData.tournaments[m._tid]) {
                    seriesName = matchesData.tournaments[m._tid].name;
                }

                fetchedMatches.push({
                    id: 'sr_' + m._id,
                    series: seriesName,
                    date: today,
                    time: m.time ? m.time.time : "TBD",
                    venue: m.venue ? m.venue.name : "Sportradar",
                    team1: { name: t1Name, logo: t1Logo, odds: "1.90" },
                    team2: { name: t2Name, logo: t2Logo, odds: "1.90" },
                    status: statusText,
                    isLive: isLive
                });
            });
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, matches: fetchedMatches })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
