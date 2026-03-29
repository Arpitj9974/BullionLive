const key1 = "AIzaSyAMIFAHxEld0XMmYo4P8T-KWY3H0woL9BM";
const key2 = "AIzaSyDoOkk3frO7_r65jpoCBiYfb18TfzMDQFI";

for (const [label, key] of [['KEY1', key1], ['KEY2', key2]]) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const d = await r.json();
  if (!d.models) { console.log(label, 'ERROR:', d); continue; }
  
  const gcModels = d.models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace('models/', ''));
  
  process.stdout.write(`\n${label} - generateContent-capable models:\n`);
  gcModels.forEach(m => process.stdout.write(`  ${m}\n`));
}
