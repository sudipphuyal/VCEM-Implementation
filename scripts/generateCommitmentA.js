const fs = require('fs');
const { buildPoseidon } = require('circomlibjs');

async function main() {
  const input = JSON.parse(fs.readFileSync('inputA.json', 'utf-8'));

  const poseidon = await buildPoseidon();
  const commitment = poseidon([
    BigInt(input.party1),
    BigInt(input.party2),
    BigInt(input.secret)
  ]);

  const commitmentStr = poseidon.F.toString(commitment); // <- Correct way

  fs.writeFileSync('build/publicA.json', JSON.stringify([commitmentStr], null, 2));
  console.log('✅ Commitment for A written to build/publicA.json');
}

main().catch((err) => {
  console.error('❌ Error generating commitment for A:', err);
});
