#!/usr/bin/env node
// Lightweight .env loader via shell sourcing (see Anchor.toml scripts.init_env)
// This script simply validates and echoes the required env vars.

const required = [
  'FOUNDER_ALLOC_WALLET',
  'FOUNDER_FEE_WALLET',
  'MARKETING_WALLET',
  'RITUAL_VAULT_WALLET',
  'TREASURY_WALLET',
];

let missing = [];
for (const key of required) {
  if (!process.env[key] || process.env[key].trim() === '') {
    missing.push(key);
  }
}

if (missing.length) {
  console.error('Missing required environment variables in .env:', missing.join(', '));
  process.exit(1);
}

console.log('Loaded 9LIVES env configuration:');
for (const key of required) {
  console.log(`${key}=${process.env[key]}`);
}

console.log('\nTip: Use these values when calling `initialize` in your client.');

