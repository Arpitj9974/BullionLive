import dotenv from 'dotenv';
dotenv.config();

const key1 = process.env.GEMINI_API_KEY_1;
const key2 = process.env.GEMINI_API_KEY_2;

for (const [label, key] of [['KEY1', key1], ['KEY2', key2]]) {
  if (!key) { console.log(label, 'NOT SET'); continue; }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const d = await r.json();
  if (!d.models) { console.log(label, 'ERROR:', d); continue; }
  
  const gcModels = d.models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace('models/', ''));
  
  process.stdout.write(`\n${label} - generateContent-capable models:\n`);
  gcModels.forEach(m => process.stdout.write(`  ${m}\n`));
}
