const fs = require('fs');
const { buildPoseidon } = require('circomlibjs');

async function main() {
  const input = JSON.parse(fs.readFileSync('inputB.json', 'utf-8'));

  const poseidon = await buildPoseidon();
  const commitment = poseidon([
    BigInt(input.party1),
    BigInt(input.party2),
    BigInt(input.secret)
  ]);

  const commitmentStr = poseidon.F.toString(commitment);

  fs.writeFileSync('build/publicB.json', JSON.stringify([commitmentStr], null, 2));
  console.log('✅ Commitment for B written to build/publicB.json');
}

main().catch((err) => {
  console.error('❌ Error generating commitment for B:', err);
});
