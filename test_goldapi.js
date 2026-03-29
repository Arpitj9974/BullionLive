import dotenv from 'dotenv';
dotenv.config();

async function testGoldApi() {
  const key = process.env.VITE_GOLD_API_KEY;
  console.log("Using key:", key);
  
  try {
    const res = await fetch('https://www.goldapi.io/api/XAG/USD', {
      headers: {
        'x-access-token': key || '',
        'Content-Type': 'application/json'
      }
    });
    
    const data = await res.json();
    console.log("GoldAPI.io Silver Response:", data);
  } catch (error) {
    console.error("Error:", error);
  }
}

testGoldApi();
