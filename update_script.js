const fs = require('node:fs');

const API_KEY = process.env.DEVTO_API_KEY;
const USERNAME = process.env.DEVTO_USERNAME;
const START = '<!-- DEVTO-FOLLOWERS-COUNT:START -->';
const END = '<!-- DEVTO-FOLLOWERS-COUNT:END -->';

async function getJson(url) {
  const response = await fetch(url, {
    headers: { 'api-key': API_KEY, 'Accept': 'application/vnd.forem.api-v1+json' },
  });
  if (!response.ok) throw new Error(`DEV API returned HTTP ${response.status} for ${url.pathname}`);
  return response.json();
}

async function main() {
  if (!API_KEY || !USERNAME) throw new Error('DEVTO_API_KEY and DEVTO_USERNAME are required');

  // This private endpoint counts the key owner's followers, not an arbitrary username.
  const me = await getJson(new URL('https://dev.to/api/users/me'));
  if (me.username?.toLowerCase() !== USERNAME.toLowerCase()) {
    throw new Error('The DEV API key does not belong to DEVTO_USERNAME');
  }

  let count = 0;
  const pageSize = 1000;
  const seenPages = new Set();
  for (let page = 1; page <= 1000; page++) {
    const url = new URL('https://dev.to/api/followers/users');
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(pageSize));
    const followers = await getJson(url);
    if (!Array.isArray(followers)) throw new Error('Unexpected followers response');
    if (followers.length === 0) break;
    // Do not publish a partial count if a proxy ignores the page argument.
    const signature = JSON.stringify(followers);
    if (seenPages.has(signature)) throw new Error('DEV API repeated a page; follower count is uncertain');
    seenPages.add(signature);
    count += followers.length;
    if (page === 1000) throw new Error('Pagination limit reached; follower count is uncertain');
    // Keep paging even if fewer than per_page items arrive: the API may cap its page size.
  }

  const path = 'README.md';
  const readme = fs.readFileSync(path, 'utf8');
  if (readme.split(START).length !== 2 || readme.split(END).length !== 2 || readme.indexOf(END) < readme.indexOf(START)) {
    throw new Error('README.md must contain one ordered DEVTO-FOLLOWERS-COUNT marker pair');
  }
  const updated = readme.replace(
    /<!-- DEVTO-FOLLOWERS-COUNT:START -->[\s\S]*?<!-- DEVTO-FOLLOWERS-COUNT:END -->/,
    `${START}\n[DEV.to](https://dev.to/${encodeURIComponent(USERNAME)}) followers: **${count}**\n${END}`,
  );
  if (updated !== readme) fs.writeFileSync(path, updated);
  console.log(`DEV.to followers: ${count}${updated === readme ? ' (unchanged)' : ' (README updated)'}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
