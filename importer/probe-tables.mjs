// One-off probe: what do BBC's league table pages look like as text? Prints the first lines of each page. No secrets used.
import { htmlToLines } from './sources/bbc.mjs';
const PAGES = {
  'premier-league': 'https://www.bbc.co.uk/sport/football/premier-league/table',
  'scottish-premiership': 'https://www.bbc.co.uk/sport/football/scottish-premiership/table',
  'champions-league': 'https://www.bbc.co.uk/sport/football/champions-league/table',
  'europa-league': 'https://www.bbc.co.uk/sport/football/europa-league/table',
  'conference-league': 'https://www.bbc.co.uk/sport/football/europa-conference-league/table',
};
for (const [k, url] of Object.entries(PAGES)) {
  console.log('\n===== ' + k + ' ' + url);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; myteamcompanion-probe/0.1)' } });
    console.log('HTTP', r.status);
    const html = await r.text();
    console.log('html bytes', html.length, '| has <table>:', /<table/i.test(html), '| has __NEXT_DATA__:', /__NEXT_DATA__/.test(html));
    const lines = htmlToLines(html);
    console.log('lines', lines.length);
    lines.slice(0, 90).forEach((l, i) => console.log(String(i).padStart(3) + ' | ' + l.slice(0, 140)));
  } catch (e) { console.log('ERR', e.message); }
}
