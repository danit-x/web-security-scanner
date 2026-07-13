require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/user');
const ScanResult = require('../models/ScanResults');

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mernstack_schema_test';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const suffix = Date.now();
  const user = await User.create({
    name: 'Schema Test User',
    email: `schema-test-${suffix}@example.com`,
    password: 'testpass123',
  });
  console.log('User saved:', {
    id: user._id,
    collection: User.collection.collectionName,
  });

  const scanResult = await ScanResult.create({
    userId: user._id,
    url: 'https://example.com',
    grade: 'B',
    findings: [
      {
        category: 'Security Headers',
        severity: 'MEDIUM',
        description: 'Missing Content-Security-Policy header',
        recommendation: 'Add a strict Content-Security-Policy header',
      },
    ],
  });
  console.log('ScanResult saved:', {
    id: scanResult._id,
    collection: ScanResult.collection.collectionName,
    scannedAt: scanResult.scannedAt,
  });

  const collections = await mongoose.connection.db
    .listCollections()
    .toArray();
  const names = collections.map((c) => c.name).sort();
  console.log('Collections in database:', names);

  const expected = ['scanresults', 'users'];
  const missing = expected.filter((name) => !names.includes(name));
  if (missing.length) {
    throw new Error(`Expected collections not found: ${missing.join(', ')}`);
  }

  console.log('Both collections exist. Cleaning up test documents...');
  await ScanResult.deleteOne({ _id: scanResult._id });
  await User.deleteOne({ _id: user._id });
  console.log('Done — schemas work correctly.');
}

main()
  .catch((err) => {
    console.error('Schema test failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
