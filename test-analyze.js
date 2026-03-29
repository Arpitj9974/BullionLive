async function test() {
  const r = await fetch('http://localhost:3001/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      marketData: {
        gold_usd: 3136.50,
        silver_usd: 34.20,
        platinum_usd: 991.50,
        usd_inr: 84.83,
        gold_change_pct: 1.2,
        silver_change_pct: -0.4,
        platinum_change_pct: 0.3
      }
    })
  });
  const data = await r.json();
  console.log('\n=== GEMINI ANALYSIS ===\n');
  console.log(data.analysis);
  console.log('\n=== END ===');
}
test();
