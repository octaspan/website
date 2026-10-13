// Rule-based classification of a report into sector, attack types, severity, verification,
// geography and disclosed financial amounts. Deliberately conservative: when the text does not
// support a value, the result is "Unknown" / empty rather than a guess.

export const SECTORS = [
  { id: 'bfsi', label: 'BFSI', re: /\b(bank|banks|banking|fintech|financial services|insurance|insurer|payment processor|payments?|credit union|brokerage|wealth management|lender|mortgage|swift|upi|stock exchange|asset manager|crypto exchange)\b/gi },
  { id: 'govt', label: 'Government', re: /\b(government|govt|ministry|federal|municipal|city of|county|state agency|public sector|military|defen[cs]e department|election|parliament|council|police|embassy|nato|armed forces|department of)\b/gi },
  { id: 'health', label: 'Healthcare', re: /\b(hospital|hospitals|healthcare|health system|medical|pharma|pharmaceutical|patient|patients|clinic|biotech|health insurer)\b/gi },
  { id: 'energy', label: 'Energy & Critical Infra', re: /\b(energy|power grid|electric utility|utility|utilities|oil|natural gas|pipeline|scada|ics|ot networks?|critical infrastructure|water treatment|nuclear|refinery|ports?|rail|airline|airport|aviation)\b/gi },
  { id: 'mfg', label: 'Manufacturing', re: /\b(manufactur\w*|factory|industrial|automotive|carmaker|steelmaker|chemical maker|aerospace)\b/gi },
  { id: 'retail', label: 'Retail & FMCG', re: /\b(retail|retailer|fmcg|consumer goods|e-?commerce|supermarket|grocery|food and beverage|restaurant|fashion|shopping|brand)\b/gi },
  { id: 'telecom', label: 'Telecommunications', re: /\b(telecom\w*|telco|mobile carrier|isp|internet provider|5g|wireless carrier)\b/gi },
  { id: 'tech', label: 'Technology & Cloud', re: /\b(cloud|saas|software vendor|tech company|data center|hosting provider|microsoft|google|apple|cisco|fortinet|ivanti|palo alto|vmware|citrix|oracle|sap|github|npm|aws|azure)\b/gi },
  { id: 'edu', label: 'Education', re: /\b(university|universities|school district|schools?|college|education|students?)\b/gi },
];
export const SECTOR_OTHER = { id: 'other', label: 'Other / Unknown' };
export const SECTOR_LABELS = Object.fromEntries([...SECTORS, SECTOR_OTHER].map((s) => [s.id, s.label]));

export const ATTACK_TYPES = [
  { id: 'ransomware', label: 'Ransomware', re: /\b(ransomware|ransom|ransom demand|extortion gang|lockbit|blackcat|alphv|akira|qilin|cl0p|clop|ransomhub|black basta|medusa ransomware|play ransomware|scattered spider)\b/i },
  { id: 'apt', label: 'APT & Espionage', re: /\b(apt\s?\d+|nation-state|state-sponsored|state-backed|espionage|lazarus|volt typhoon|salt typhoon|sandworm|fancy bear|cozy bear|midnight blizzard|kimsuky|turla|unc\d{3,5}|storm-\d{3,4}|threat actors? linked to)\b/i },
  { id: 'supply', label: 'Supply-chain', re: /\b(supply[- ]chain|malicious (npm|pypi) package|npm package|pypi|third-party (vendor|provider) (breach|compromise)|software update (compromise|hijack))\b/i },
  { id: 'vuln', label: 'Vulnerability exploitation', re: /\b(cve-\d{4}-\d{4,7}|vulnerabilit\w+|zero-day|0-day|remote code execution|\brce\b|actively exploited|exploited in the wild|privilege escalation|authentication bypass)\b/i },
  { id: 'breach', label: 'Data breach & exfiltration', re: /\b(data breach|breach(ed)?|data leak\w*|leaked data|exfiltrat\w+|stolen data|exposed (data|records|database)|records (were )?(stolen|exposed))\b/i },
  { id: 'malware', label: 'Malware', re: /\b(malware|trojan|backdoor|infostealer|info-stealer|stealer|botnet|rootkit|spyware|loader|rat\b|wiper|cryptominer)\b/i },
  { id: 'phishing', label: 'Phishing & social engineering', re: /\b(phishing|smishing|vishing|social engineering|business email compromise|\bbec\b|fake (login|invoice)|spear-?phish\w*)\b/i },
  { id: 'cred', label: 'Credential theft & account compromise', re: /\b(credential\w*|password\w*|account takeover|credential stuffing|mfa bypass|session hijack\w*|token theft|stolen accounts?|account compromise)\b/i },
  { id: 'ddos', label: 'DDoS', re: /\b(ddos|denial[- ]of[- ]service|botnet attack traffic)\b/i },
  { id: 'insider', label: 'Insider threat', re: /\b(insider threat|rogue employee|malicious insider|former employee (accessed|stole))\b/i },
];
// AI/LLM attacks need a case-sensitive "AI" so words like "said" or "detail" never match.
const AI_RE = /(\bAI\b|\bLLMs?\b|prompt injection|jailbreak|generative AI|ChatGPT|OpenAI|Copilot|Gemini|Claude|model poisoning|\bMCP\b|agentic|AI agents?|deepfake)/;
ATTACK_TYPES.push({ id: 'ai', label: 'AI & LLM attacks', re: AI_RE, caseSensitive: true });
ATTACK_TYPES.push({ id: 'other', label: 'Other / Unknown' });
export const ATTACK_LABELS = Object.fromEntries(ATTACK_TYPES.map((a) => [a.id, a.label]));
// When a report matches several types, the primary one is the first match in this order.
const PRIMARY_ORDER = ['ransomware', 'apt', 'supply', 'ai', 'breach', 'vuln', 'malware', 'phishing', 'cred', 'ddos', 'insider'];

export const REGIONS = ['North America', 'Europe', 'Asia Pacific', 'Middle East & Africa', 'Latin America'];
const C = (name, region, ...aliases) => ({ name, region, re: new RegExp(`(?<![\\w.])(${[name, ...aliases].join('|')})(?![\\w])(?!-(?:linked|backed|based|nexus|sponsored|aligned|speaking))`, 'g') });
export const COUNTRIES = [
  C('United States', 'North America', 'U\\.S\\.', 'US', 'USA', 'America', 'American'), C('Canada', 'North America', 'Canadian'),
  C('Mexico', 'Latin America'), C('Brazil', 'Latin America'), C('Argentina', 'Latin America'), C('Chile', 'Latin America'), C('Colombia', 'Latin America'), C('Peru', 'Latin America'),
  C('United Kingdom', 'Europe', 'UK', 'U\\.K\\.', 'Britain', 'British', 'England', 'Scotland', 'Wales'), C('Ireland', 'Europe', 'Irish'),
  C('Germany', 'Europe', 'German'), C('France', 'Europe', 'French'), C('Italy', 'Europe', 'Italian'), C('Spain', 'Europe', 'Spanish'),
  C('Netherlands', 'Europe', 'Dutch'), C('Belgium', 'Europe', 'Belgian'), C('Switzerland', 'Europe', 'Swiss'), C('Austria', 'Europe', 'Austrian'),
  C('Poland', 'Europe', 'Polish'), C('Sweden', 'Europe', 'Swedish'), C('Norway', 'Europe', 'Norwegian'), C('Denmark', 'Europe', 'Danish'),
  C('Finland', 'Europe', 'Finnish'), C('Ukraine', 'Europe', 'Ukrainian'), C('Portugal', 'Europe', 'Portuguese'), C('Greece', 'Europe', 'Greek'),
  C('Czech Republic', 'Europe', 'Czech'), C('Romania', 'Europe', 'Romanian'), C('Turkey', 'Middle East & Africa', 'Turkish'),
  C('India', 'Asia Pacific', 'Indian'), C('Singapore', 'Asia Pacific', 'Singaporean'), C('Japan', 'Asia Pacific', 'Japanese'),
  C('South Korea', 'Asia Pacific', 'South Korean'), C('Australia', 'Asia Pacific', 'Australian'), C('New Zealand', 'Asia Pacific'),
  C('Indonesia', 'Asia Pacific', 'Indonesian'), C('Malaysia', 'Asia Pacific', 'Malaysian'), C('Philippines', 'Asia Pacific', 'Philippine'),
  C('Thailand', 'Asia Pacific', 'Thai'), C('Vietnam', 'Asia Pacific', 'Vietnamese'), C('Taiwan', 'Asia Pacific', 'Taiwanese'),
  C('Hong Kong', 'Asia Pacific'), C('Pakistan', 'Asia Pacific', 'Pakistani'), C('Bangladesh', 'Asia Pacific'),
  C('United Arab Emirates', 'Middle East & Africa', 'UAE', 'Dubai', 'Emirati'), C('Saudi Arabia', 'Middle East & Africa', 'Saudi'),
  C('Israel', 'Middle East & Africa', 'Israeli'), C('Qatar', 'Middle East & Africa'), C('Egypt', 'Middle East & Africa', 'Egyptian'),
  C('South Africa', 'Middle East & Africa'), C('Nigeria', 'Middle East & Africa', 'Nigerian'), C('Kenya', 'Middle East & Africa', 'Kenyan'),
  C('Iran', 'Middle East & Africa'), C('Russia', 'Europe'), C('China', 'Asia Pacific'), C('North Korea', 'Asia Pacific'),
];
// Origin phrases: how a source attributes an attack. Never inferred from IPs, only repeated when stated.
const ORIGIN_RE = [
  ['China', /\b(china|chinese)(-linked|-backed|-nexus|-based|-sponsored|-aligned)?\s+(hackers?|threat actors?|apt|group|state|espionage|actors?)|china-(linked|backed|nexus|sponsored|aligned)/i],
  ['Russia', /\b(russia|russian)(-linked|-backed|-nexus|-based|-sponsored|-aligned)?\s+(hackers?|threat actors?|apt|group|state|espionage|actors?)|russia-(linked|backed|nexus|sponsored|aligned)/i],
  ['Iran', /\b(iran|iranian)(-linked|-backed|-nexus|-based|-sponsored|-aligned)?\s+(hackers?|threat actors?|apt|group|state|espionage|actors?)|iran-(linked|backed|nexus|sponsored|aligned)/i],
  ['North Korea', /\b(north korea|north korean|dprk)(-linked|-backed|-nexus|-sponsored|-aligned)?\s+(hackers?|threat actors?|apt|group|state|actors?)|north korea-(linked|backed|nexus|sponsored)/i],
];

const ACTORS_RE = /\b(LockBit|BlackCat|ALPHV|Akira|Qilin|Cl0p|Clop|RansomHub|Black Basta|Scattered Spider|ShinyHunters|Medusa|Lazarus|Kimsuky|Turla|Sandworm|Volt Typhoon|Salt Typhoon|Midnight Blizzard|Fancy Bear|Cozy Bear|APT\s?\d{1,2}|UNC\d{3,5}|FIN\d{1,2}|Storm-\d{3,4})\b/g;

const INCIDENT_RE = /\b(ransom|breach(ed)?|hacked|hit by|cyber-?attack|attack(ed)? on|ransomware attack|data leak\w*|exposed|compromis\w+|outage|disrupt\w*|claims? (responsibility|to have)|stolen|exfiltrat\w+|suffers?|confirms?|discloses?|targets?|targeted|attackers? (stole|hit))\b/i;
const CAMPAIGN_RE = /\b(campaign|threat actors?|researchers? (found|have|say|uncover)|new malware|operation|uncover\w*|tracked as|attributed to)\b/i;
const CONFIRM_RE = /\b(confirm(ed|s)?|disclos(ed|es|ure)|8-k|in a (filing|statement)|notif(ied|ication)|acknowledg\w+|spokesperson|the company said|officially)\b/i;
const CLAIM_RE = /\b(claims?|claimed|allegedly|alleged|purportedly|reportedly|says it|threat actor says|hackers? say|posted on (its|their) leak site)\b/i;

const count = (re, text) => { re.lastIndex = 0; let n = 0; while (re.exec(text)) n++; return n; };

function firstCountry(title, summary) {
  let best = null;
  for (const text of [title, summary]) {
    for (const c of COUNTRIES) {
      c.re.lastIndex = 0;
      const m = c.re.exec(text);
      if (m && (!best || m.index < best.idx)) best = { name: c.name, region: c.region, idx: m.index };
    }
    if (best) break; // a headline match wins over anything only found in the excerpt
  }
  return best;
}

export function extractFinancial(text) {
  const out = [];
  const re = /(?:(CA|AU|NZ|S|US)?\$|€|£|₹|\bRs\.?\s?|\bINR\s?|\bUSD\s?|\bEUR\s?|\bGBP\s?)\s?(\d[\d,]*(?:\.\d+)?)(?:\s?(billion|million|thousand|crore|lakh|bn|m|k)\b)?/gi;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const sym = raw.trim();
    let currency = 'USD';
    if (/^€|^EUR/i.test(sym)) currency = 'EUR';
    else if (/^£|^GBP/i.test(sym)) currency = 'GBP';
    else if (/^₹|^Rs|^INR/i.test(sym)) currency = 'INR';
    else if (/^CA\$/i.test(sym)) currency = 'CAD';
    else if (/^AU\$/i.test(sym)) currency = 'AUD';
    else if (/^NZ\$/i.test(sym)) currency = 'NZD';
    else if (/^S\$/i.test(sym)) currency = 'SGD';
    const unit = (m[3] || '').toLowerCase();
    const mult = { billion: 1e9, bn: 1e9, million: 1e6, m: 1e6, thousand: 1e3, k: 1e3, crore: 1e7, lakh: 1e5 }[unit] || 1;
    const amount = parseFloat(m[2].replace(/,/g, '')) * mult;
    if (!isFinite(amount) || amount < 10000) continue;
    const ctx = text.slice(Math.max(0, m.index - 80), m.index + raw.length + 80).toLowerCase();
    let type = null;
    if (/\bransom\b|ransom (demand|payment|note)/.test(ctx)) type = /(paid|pay(ing|ment)?|handed over)/.test(ctx) ? 'ransom_paid' : 'ransom_demanded';
    else if (/(fine|fined|penalty|settle|settlement)/.test(ctx)) type = 'regulatory';
    else if (/(insurance|insurer|claim)/.test(ctx)) type = 'insurance';
    else if (/(stolen|theft|heist|drained|siphon\w*)/.test(ctx)) type = 'theft_loss';
    else if (/(cost|costs|expenses?|charges?|remediation|recovery)/.test(ctx) && /(incident|breach|attack|cyber)/.test(ctx)) type = 'incident_cost';
    else if (/(loss|losses|revenue|interruption|damage)/.test(ctx) && /(incident|breach|attack|cyber|outage)/.test(ctx)) type = 'business_interruption';
    if (!type) continue; // an amount with no clear cyber-impact context is ignored, never guessed
    const status = /(allegedly|claims?|claimed|demand\w*)/.test(ctx) ? 'alleged'
      : /(estimat\w+|could|up to|as much as|potential|expected)/.test(ctx) ? 'estimated' : 'reported';
    out.push({ amount, currency, original: raw.trim(), type, status });
  }
  return out;
}

export function classify({ title, summary = '', source }) {
  const text = `${title}. ${summary}`;
  const cat = source.category;

  // sector: highest keyword score on headline (x3) + excerpt; ties and zero => Other / Unknown
  let sector = SECTOR_OTHER;
  let bestScore = 0;
  for (const s of SECTORS) {
    const score = count(s.re, title) * 3 + count(s.re, summary);
    if (score > bestScore) { bestScore = score; sector = s; }
  }

  const attackTypes = ATTACK_TYPES.filter((a) => a.re && (a.caseSensitive ? a.re.test(text) : a.re.test(text))).map((a) => a.id);
  const primaryAttack = PRIMARY_ORDER.find((id) => attackTypes.includes(id)) || 'other';
  if (!attackTypes.length) attackTypes.push('other');

  const cves = [...new Set((text.match(/CVE-\d{4}-\d{4,7}/gi) || []).map((c) => c.toUpperCase()))];
  const actors = [...new Set((text.match(ACTORS_RE) || []).map((a) => a.replace(/\s+/g, '')))];
  const isApt = attackTypes.includes('apt');
  const hasVuln = cves.length > 0 || attackTypes.includes('vuln');
  const exploited = /\b(actively exploited|exploited in the wild|zero-day|0-day|known exploited|kev)\b/i.test(text) || (cat === 'advisory' && /known exploited/i.test(text));

  let kind;
  if (cat === 'sec') kind = 'incident';
  else if (hasVuln && !/\b(breach(ed)?|ransomware attack|hacked)\b/i.test(title)) kind = 'vulnerability';
  else if (INCIDENT_RE.test(title) && !/\b(report|guide|how to|webinar|best practices)\b/i.test(title) && cat !== 'research') kind = 'incident';
  else if (isApt || CAMPAIGN_RE.test(text) || cat === 'research') kind = 'campaign';
  else if (cat === 'advisory') kind = 'advisory';
  else kind = attackTypes[0] !== 'other' ? (INCIDENT_RE.test(text) ? 'incident' : 'campaign') : 'other';

  // verification: first-party sources are confirmed; otherwise the text decides. A claim wins over weak confirmation.
  let verification = 'reported';
  if (cat === 'sec' || cat === 'advisory') verification = 'confirmed';
  else if (CLAIM_RE.test(text) && !/\b(confirm(ed|s)|8-k|filing)\b/i.test(text)) verification = 'claimed';
  else if (CONFIRM_RE.test(text)) verification = 'confirmed';
  else if (cat === 'research') verification = 'reported';

  // severity is an estimate from textual evidence, labelled as such in the UI
  let severity = 'info';
  if (/\bcvss[^0-9]{0,12}(9\.\d|10(\.0)?)\b/i.test(text) || (hasVuln && exploited && /\bcritical\b/i.test(text)) || (kind === 'vulnerability' && /\bcritical\b/i.test(text))) severity = 'critical';
  else if (exploited || attackTypes.includes('ransomware') || isApt || attackTypes.includes('supply') || /\b(millions?|thousands?) of (customers|users|patients|records)\b/i.test(text)) severity = kind === 'advisory' && !exploited ? 'medium' : 'high';
  else if (kind === 'incident') severity = ['ddos'].includes(primaryAttack) ? 'low' : 'medium';
  else if (kind === 'vulnerability') severity = 'medium';
  else if (kind === 'campaign') severity = 'medium';

  const country = firstCountry(title, summary);
  const originHit = ORIGIN_RE.find(([, re]) => re.test(text));

  return {
    kind,
    sector: sector.id,
    attackTypes,
    primaryAttack,
    severity,
    verification,
    cves,
    actors,
    isApt,
    exploited,
    country: country ? country.name : null,
    region: country ? country.region : null,
    suspectedOrigin: originHit ? originHit[0] : null, // as stated by the source, never inferred
    financial: extractFinancial(text),
  };
}
