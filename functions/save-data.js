const axios = require('axios');

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { matches, heroData } = JSON.parse(event.body);
        const token = process.env.GITHUB_TOKEN; // Set this in Netlify
        const repo = "bigwin959/cclanding"; // Hardcoded or env var
        const branch = "main";

        if (!token) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Missing GITHUB_TOKEN in Netlify Environment Variables" })
            };
        }

        const updates = [];
        if (matches) updates.push({ path: 'data.json', content: JSON.stringify(matches, null, 4) });
        if (heroData) updates.push({ path: 'hero_data.json', content: JSON.stringify(heroData, null, 4) });

        for (const update of updates) {
            // 1. Get current SHA
            const fileUrl = `https://api.github.com/repos/${repo}/contents/${update.path}?ref=${branch}`;
            let sha = null;

            try {
                const { data: currentFile } = await axios.get(fileUrl, {
                    headers: { Authorization: `token ${token}` }
                });
                sha = currentFile.sha;
            } catch (e) {
                // File might not exist yet, that's okay
                console.log(`File ${update.path} not found, creating new.`);
            }

            // 2. Update file
            await axios.put(fileUrl, {
                message: `Update ${update.path} from Admin Panel via Netlify`,
                content: Buffer.from(update.content).toString('base64'),
                sha: sha,
                branch: branch
            }, {
                headers: { Authorization: `token ${token}` }
            });
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: "Use Github Token to Saved!" })
        };

    } catch (error) {
        console.error("GitHub Save Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
