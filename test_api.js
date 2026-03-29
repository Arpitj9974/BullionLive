async function test() {
  const key = "AIzaSyAMIFAHxEld0XMmYo4P8T-KWY3H0woL9BM";
  try {
      const prompt = `You are a financial expert. Given these live market prices: {}, answer: "test". Return JSON: {"analysis": "your detailed analysis here"}`;
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        }
      );
      const data = await r.json();
      console.log("Status:", r.status);
      console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(e);
    }
}
test();
