// Deduplication: groups reports about the same incident/vulnerability so that one event covered
// by several publications is counted once. Rules (all must be explainable):
//   1. reports sharing a CVE id are the same cluster (vulnerability coverage), or
//   2. reports published within 5 days whose headlines share >= 3 significant words and have
//      Jaccard similarity >= 0.5 are the same cluster.
const STOP = new Set('the a an and or of to in on for with by from at as is are was were be been has have had it its this that new says said after over into about than their they them via more most not but how why what who will can may could report reports reported attack attacks cyber security hackers hacker data'.split(' '));
const tokens = (t) => new Set(String(t).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

export function clusterReports(reports) {
  const n = reports.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); };
  const toks = reports.map((r) => tokens(r.title));
  const byCve = new Map();
  reports.forEach((r, i) => (r.cves || []).forEach((c) => { if (byCve.has(c)) union(i, byCve.get(c)); else byCve.set(c, i); }));
  const FIVE_DAYS = 5 * 86400e3;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(reports[i].publishedAt - reports[j].publishedAt) > FIVE_DAYS) continue;
      if (find(i) === find(j)) continue;
      let inter = 0;
      toks[i].forEach((w) => { if (toks[j].has(w)) inter++; });
      const union_ = toks[i].size + toks[j].size - inter;
      if (inter >= 3 && union_ > 0 && inter / union_ >= 0.5) union(i, j);
    }
  }
  const clusters = new Map();
  reports.forEach((r, i) => {
    const root = find(i);
    const key = 'C-' + reports[root].id;
    r.clusterId = key;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(r);
  });
  return clusters;
}
