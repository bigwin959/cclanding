const axios = require('axios');
const cheerio = require('cheerio');

exports.handler = async function (event, context) {
    const type = event.queryStringParameters.type || 'live';

    try {
        let requestedDate = null;
        let category = type;

        if (category.includes('date=')) {
            requestedDate = category.split('date=')[1];
            category = 'schedule';
        }

        console.log(`Fetching merged Cricbuzz data... Category: ${category}`);

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
                const bigScript = scripts.find(s => s && (s.includes('currentMatchesList') || s.includes('matchesList') || s.includes('scheduleData')));

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
                timestamp: m.timestamp
            };

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
        // Schedule is pre-filtered

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, matches: finalMatches })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
