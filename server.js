const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3005;
const DATA_FILE = path.join(__dirname, 'data.json');
const HERO_FILE = path.join(__dirname, 'hero_data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Helper to read data
function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return [];
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(content || '[]');
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.error("Error reading data file:", err);
        return [];
    }
}

// Helper to write data
function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4));
    } catch (err) {
        console.error("Error writing data file:", err);
    }
}


// Helper to read hero data
function readHeroData() {
    try {
        if (!fs.existsSync(HERO_FILE)) {
            return {
                imageUrl: "https://res.cloudinary.com/dmyocpyxd/image/upload/v1768741799/1.jpg",
                title: "BANGLADESH PREMIER LEAGUE",
                promoCode: "BPL2026",
                bonusTitle: "🎁 WELCOME BONUS",
                bonusDesc: "Deposit <span class='text-yellow-400 font-bold'>500 BDT</span> & Get <span class='text-yellow-400 font-bold'>500 BDT FREE</span>",
                bonusButtonText: "CLAIM 100% BONUS NOW",
                bonusButtonLink: "https://www.bigwin959.com/?tid=56086&affiliateCode=heylinkvideo&fbPixelId=1093698699511405"
            };
        }
        const content = fs.readFileSync(HERO_FILE, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        console.error("Error reading hero data file:", err);
        return {
            imageUrl: "https://res.cloudinary.com/dmyocpyxd/image/upload/v1768741799/1.jpg",
            title: "BANGLADESH PREMIER LEAGUE",
            promoCode: "BPL2026",
            bonusTitle: "🎁 WELCOME BONUS",
            bonusDesc: "Deposit <span class='text-yellow-400 font-bold'>500 BDT</span> & Get <span class='text-yellow-400 font-bold'>500 BDT FREE</span>",
            bonusButtonText: "CLAIM 100% BONUS NOW",
            bonusButtonLink: "https://www.bigwin959.com/?tid=56086&affiliateCode=heylinkvideo&fbPixelId=1093698699511405",
            navIconClass: "fa-solid fa-trophy text-yellow-500 text-xl",
            navTitleHTML: "BPL<span class='text-green-500'>2026</span>",
            liveSectionLink: "https://www.bigwin959.com/register?affiliateCode=cricket001",
            navBackgroundColor: "#1e293b",
            bodyBackgroundColor: "#0f172a",
            bonusGradientStart: "#064e3b",
            bonusGradientEnd: "#0f172a",
            bonusTitleColor: "#ffffff",
            bonusDescColor: "#cbd5e1",
            bonusAccentColor: "#facc15",
            bonusButtonTextColor: "#000000",
            bonusButtonGradientStart: "#F59E0B",
            bonusButtonGradientEnd: "#D97706",
            socialContacts: [
                { name: "Facebook", link: "#", icon: "fa-brands fa-facebook", color: "#1877F2" },
                { name: "Telegram", link: "#", icon: "fa-brands fa-telegram", color: "#24A1DE" },
                { name: "WhatsApp", link: "#", icon: "fa-brands fa-whatsapp", color: "#25D366" }
            ]
        };
    }
}

// Helper to write hero data
function writeHeroData(data) {
    try {
        fs.writeFileSync(HERO_FILE, JSON.stringify(data, null, 4));
    } catch (err) {
        console.error("Error writing hero data file:", err);
    }
}

// Helper to scrape Cricbuzz data with detailed Multi-Timezone info
async function scrapeMatchData(category = 'live') {
    try {
        let requestedDate = null;
        if (category.includes('date=')) {
            requestedDate = category.split('date=')[1];
            category = 'schedule';
        }

        console.log(`Fetching merged Cricbuzz data... Category: ${category} ${requestedDate ? `for date ${requestedDate}` : ''}`);

        const urlsToFetch = ['https://www.cricbuzz.com/cricket-match/live-scores'];

        if (category === 'schedule' || requestedDate) {
            urlsToFetch.push('https://www.cricbuzz.com/cricket-match/live-scores/upcoming-matches');
            urlsToFetch.push('https://www.cricbuzz.com/cricket-schedule/upcoming-series/international');
            urlsToFetch.push('https://www.cricbuzz.com/cricket-schedule/upcoming-series/t20-leagues');
            urlsToFetch.push('https://www.cricbuzz.com/cricket-schedule/upcoming-series/domestic');
        } else if (category === 'upcoming') {
            urlsToFetch.push('https://www.cricbuzz.com/cricket-match/live-scores/upcoming-matches');
        } else if (category === 'recent') {
            urlsToFetch.push('https://www.cricbuzz.com/cricket-match/live-scores/recent-matches');
        }

        const allRawMatches = [];
        const liveInfoMap = new Map();

        for (const url of urlsToFetch) {
            try {
                const { data: html } = await axios.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36' }
                });
                const $ = cheerio.load(html);
                const scripts = $('script').map((i, el) => $(el).html()).get();
                const bigScript = scripts.find(s => s.includes('currentMatchesList') || s.includes('matchesList') || s.includes('scheduleData'));

                if (!bigScript) continue;

                const clean = bigScript.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                const blocks = clean.match(/"matchId":\d+.*?"team2":\{.*?\}(?:,.*?"venueInfo":\{.*?\})?/g) || [];

                blocks.forEach(block => {
                    const idM = block.match(/"matchId":(\d+)/);
                    if (!idM) return;
                    const id = idM[1];

                    let series = "Cricket Series";
                    const sInB = block.match(/"seriesName":"(.*?)"/);
                    if (sInB) {
                        series = sInB[1];
                    } else {
                        const idx = clean.indexOf(`"matchId":${id}`);
                        if (idx !== -1) {
                            const b4 = clean.substring(0, idx);
                            const allS = Array.from(b4.matchAll(/"seriesName":"(.*?)"/g));
                            if (allS.length > 0) series = allS[allS.length - 1][1];
                        }
                    }

                    const statusM = block.match(/"status":"(.*?)"/);
                    const stateM = block.match(/"state":"(.*?)"/);
                    const startM = block.match(/"startDate":(?:"|)(\d+)/);
                    const venueM = block.match(/"venueInfo":(\{.*?\})/);

                    const status = statusM ? statusM[1] : (stateM ? stateM[1] : "Scheduled");
                    const state = stateM ? stateM[1] : "";

                    if (url === 'https://www.cricbuzz.com/cricket-match/live-scores') {
                        liveInfoMap.set(id, { status, state });
                    }

                    let dateStr = "";
                    let fullTimeStr = "";
                    let timestamp = 0;
                    let isTargetDate = !requestedDate;

                    if (startM) {
                        timestamp = parseInt(startM[1]);
                        const dt = new Date(timestamp);
                        const now = new Date();
                        const tomorrow = new Date();
                        tomorrow.setDate(now.getDate() + 1);

                        const isToday = dt.toDateString() === now.toDateString();
                        const isTomorrow = dt.toDateString() === tomorrow.toDateString();
                        const dayNum = String(dt.getDate()).padStart(2, '0');
                        const monthNum = String(dt.getMonth() + 1).padStart(2, '0');
                        const yearNum = dt.getFullYear();
                        dateStr = isToday ? "Today" : (isTomorrow ? "Tomorrow" : `${dayNum}/${monthNum}/${yearNum}`);

                        const formatT = (d, isUTC = false) => {
                            let hh = isUTC ? d.getUTCHours() : d.getHours();
                            const mm = String(isUTC ? d.getUTCMinutes() : d.getMinutes()).padStart(2, '0');
                            const ap = hh >= 12 ? 'PM' : 'AM';
                            hh = hh % 12 || 12;
                            return `${String(hh).padStart(2, '0')}:${mm} ${ap}`;
                        };

                        const userT = formatT(dt);
                        const gmtT = formatT(dt, true);
                        let localT = gmtT;

                        if (venueM) {
                            try {
                                const v = JSON.parse(venueM[1]);
                                if (v.timezone) {
                                    const tz = v.timezone;
                                    const sign = tz.startsWith('-') ? -1 : 1;
                                    const p = tz.substring(1).split(':');
                                    const off = sign * (parseInt(p[0]) * 60 + parseInt(p[1]));
                                    const vDt = new Date(timestamp + (off * 60000));
                                    localT = formatT(vDt, true);
                                }
                            } catch (e) { }
                        }
                        fullTimeStr = `${userT} / ${gmtT} (GMT) / ${localT} (LOCAL)`;

                        if (requestedDate) {
                            const [ry, rm, rd] = requestedDate.split('-');
                            if (dayNum === rd && monthNum === rm && String(yearNum) === ry) {
                                isTargetDate = true;
                            } else {
                                isTargetDate = false;
                            }
                        }
                    }

                    if (!isTargetDate && category === 'schedule') return;

                    const t1M = block.match(/"team1":(\{.*?\})/);
                    const t2M = block.match(/"team2":(\{.*?\})/);

                    if (t1M && t2M) {
                        const extractT = (tB) => {
                            const nM = tB.match(/"teamName":"(.*?)"/);
                            const iM = tB.match(/"imageId":(\d+)/);
                            const name = nM ? nM[1] : "Unknown Team";
                            return {
                                name: name,
                                logo: iM ? `https://static.cricbuzz.com/a/img/v1/152x152/i1/c${iM[1]}/i.jpg` : `https://placehold.co/152x152?text=${encodeURIComponent(name.charAt(0))}`
                            };
                        };
                        const t1 = extractT(t1M[1]);
                        const t2 = extractT(t2M[1]);
                        allRawMatches.push({ id, series, dateStr, fullTimeStr, t1, t2, status, state, url, timestamp });
                    }
                });
            } catch (err) {
                console.error(`Error scraping ${url}:`, err.message);
            }
        }

        const mergedMatches = new Map();
        allRawMatches.forEach(m => {
            const live = liveInfoMap.get(m.id);
            const status = live ? live.status : m.status;
            const state = live ? live.state : m.state;
            const isLive = state === "In Progress" || status.includes("Need") || status.includes("trails") || status.includes("leads");

            const entry = {
                id: 'cb_' + m.id,
                series: m.series,
                date: m.dateStr || "Today",
                time: m.fullTimeStr || "Live",
                venue: "Cricbuzz Data",
                team1: { name: m.t1.name, logo: m.t1.logo, odds: "1.90" },
                team2: { name: m.t2.name, logo: m.t2.logo, odds: "1.90" },
                status: status,
                isLive: isLive,
                timestamp: m.timestamp,
                state: state
            };

            // Deduplication
            const existing = mergedMatches.get(m.id);
            if (!existing || (!existing.date.includes('/') && m.dateStr.includes('/')) || (existing.time.length < m.fullTimeStr.length)) {
                mergedMatches.set(m.id, entry);
            }
        });

        // Filter Logic
        let finalMatches = Array.from(mergedMatches.values());
        const now = Date.now();
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = yesterdayDate.toDateString();

        if (category === 'live') {
            finalMatches = finalMatches.filter(m => m.isLive);
        } else if (category === 'upcoming') {
            finalMatches = finalMatches.filter(m => {
                const isFinished = m.state === "Complete" || m.status.includes("won");
                const inFuture = m.timestamp > now;
                return !m.isLive && !isFinished && (inFuture || m.status === 'Scheduled');
            });
        } else if (category === 'recent') {
            finalMatches = finalMatches.filter(m => {
                if (!m.timestamp) return false;
                const d = new Date(m.timestamp);
                return d.toDateString() === yesterdayStr;
            });
        }
        // For schedule, strict filtering was applied during iteration via `isTargetDate` check (with `return`), 
        // but we double check if any leaked. 
        // Actually, in the loop: `if (!isTargetDate && category === 'schedule') return;` handles filtering BEFORE pushing to `allRawMatches`.
        // So `finalMatches` should already be filtered.

        return finalMatches;
    } catch (error) {
        console.error("Error in enhanced fetching:", error.message);
        return [];
    }
}

// Helper to scrape Sportradar (LMT)
async function scrapeSportradarData() {
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
        return fetchedMatches;
    } catch (error) {
        console.error("Error fetching Sportradar data:", error.message);
        return [];
    }
}

// API Routes
app.get('/api/matches', (req, res) => {
    res.json(readData());
});

app.post('/api/matches', (req, res) => {
    const match = req.body;
    let matches = readData();

    if (match.id) {
        // Update existing
        const idx = matches.findIndex(m => String(m.id) === String(match.id));
        if (idx !== -1) {
            matches[idx] = match;
        } else {
            // If ID provided but not found, just push it (might be a generated ID)
            matches.push(match);
        }
    } else {
        // Add new
        match.id = Date.now().toString(); // Simple ID generation
        matches.push(match);
    }

    writeData(matches);
    res.json({ success: true, match });
});

app.delete('/api/matches/:id', (req, res) => {
    const { id } = req.params;
    let matches = readData();
    const filtered = matches.filter(m => String(m.id) !== String(id));
    writeData(filtered);
    res.json({ success: true });
});

app.get('/api/fetch-online', async (req, res) => {
    const type = req.query.type || 'live';
    const matches = await scrapeMatchData(type);
    res.json({ success: true, matches });
});

app.get('/api/fetch-sportradar', async (req, res) => {
    const matches = await scrapeSportradarData();
    res.json({ success: true, matches });
});

app.get('/api/hero', (req, res) => {
    res.json(readHeroData());
});

app.post('/api/hero', (req, res) => {
    const data = req.body;
    writeHeroData(data);
    res.json({ success: true, data });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
