import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(os.tmpdir(), 'xclip-test-' + Date.now());

async function runVerification() {
  console.log('--- Running XClip Core Verification ---');
  fs.mkdirSync(testDir, { recursive: true });

  // 1. Test Crypto
  const { encryptPayload, decryptPayload, generatePairingCode, generateRandomSecret } =
    await import('../dist/main/sync/crypto.js');

  const code = generatePairingCode();
  console.log('✓ Pairing code generation:', code);
  if (!/^\d{3} \d{3}$/.test(code)) throw new Error('Invalid code format: ' + code);

  const secret = generateRandomSecret();
  const testData = { text: 'Hello, local encrypted world!', time: Date.now() };
  const encrypted = encryptPayload(testData, secret);
  console.log('✓ AES-256-GCM encryption verified (IV:', encrypted.iv.slice(0, 8) + '...)');

  const decrypted = decryptPayload(encrypted, secret);
  if (decrypted.text !== testData.text) throw new Error('Decryption mismatch');
  console.log('✓ AES-256-GCM decryption verified with auth tag');

  // 2. Test Content Classifier
  const { classifyText, computeHash } = await import('../dist/main/clipboard/classifier.js');

  const urlRes = classifyText('https://github.com/x2nios/xclip');
  if (urlRes.type !== 'URL') throw new Error('URL classification failed');
  console.log('✓ URL classification verified');

  const codeRes = classifyText('const app = express();\napp.listen(3000);');
  if (codeRes.type !== 'CODE') throw new Error('Code classification failed');
  console.log(`✓ Code classification verified (Language: ${codeRes.language})`);

  const secretRes = classifyText('ghp_abcdef1234567890abcdef1234567890ABCD');
  if (!secretRes.isPotentialPassword) throw new Error('Secret heuristic detection failed');
  console.log('✓ Password & API key heuristic filter verified');

  // 3. Test SQLite Persistence
  const { DatabaseManager } = await import('../dist/main/database/database.js');
  const db = new DatabaseManager();
  await db.init(testDir);
  console.log('✓ SQLite database initialized at', testDir);

  const item1 = db.insertItem({
    id: 'test-1',
    type: 'TEXT',
    content: 'npm install electron',
    preview: 'npm install electron',
    hash: computeHash('npm install electron'),
    source_device_id: 'test-dev',
    is_pinned: true,
  });
  console.log('✓ Inserted item:', item1.content);

  const items = db.getItems();
  if (items.length !== 1 || !items[0].is_pinned) throw new Error('Item retrieval failed');
  console.log('✓ Item retrieval and pinning verified');

  // 4. Test Deduplication lookup
  const duplicate = db.findRecentByHash(computeHash('npm install electron'));
  if (!duplicate) throw new Error('Duplicate hash lookup failed');
  console.log('✓ Duplicate hash lookup verified');

  // Cleanup test dir
  db.close();
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('--- ALL CORE TESTS PASSED SUCCESSFULLY! ---');
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
