/**
 * scripts/show-config.ts
 *
 * Prints the derived config PDA and its on-chain data.
 * - Loads .env (for comparison only)
 * - Uses AnchorProvider.env() and connects to Devnet (unless overridden)
 * - Derives ["config"] PDA and fetches the `config` account
 * - Compares founder/marketing/ritual vault wallets to .env values
 */

import * as fs from 'fs';
import * as path from 'path';
import * as anchor from '@coral-xyz/anchor';

function loadDotEnv(file = '.env') {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  const content = fs.readFileSync(p, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

async function main() {
  loadDotEnv();

  if (!process.env.ANCHOR_PROVIDER_URL) {
    process.env.ANCHOR_PROVIDER_URL = 'https://api.devnet.solana.com';
  }

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const workspaceAny: any = (anchor as any).workspace;
  let program: anchor.Program;
  if (workspaceAny && workspaceAny.NineLives) {
    program = workspaceAny.NineLives as anchor.Program;
  } else {
    const all = Object.values(workspaceAny || {});
    if (!all.length) throw new Error('No programs found in anchor.workspace. Did you build the IDL?');
    program = all[0] as anchor.Program;
  }

  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    program.programId
  );
  console.log('Config PDA:', configPda.toBase58());

  try {
    const cfg: any = await (program.account as any)['config'].fetch(configPda);

    const toB58 = (k: any) => {
      if (!k) return '';
      if (typeof k === 'string') return k;
      if (k.toBase58) return k.toBase58();
      try { return new anchor.web3.PublicKey(k).toBase58(); } catch { return String(k); }
    };
    const get = (o: any, snake: string, camel: string) => (o?.[snake] ?? o?.[camel]);

    const envFounder = process.env.FOUNDER_FEE_WALLET || '';
    const envMarketing = process.env.MARKETING_WALLET || '';
    const envRitual = process.env.RITUAL_VAULT_WALLET || '';

    const onchainFounder = toB58(get(cfg, 'founder_wallet', 'founderWallet'));
    const onchainMarketing = toB58(get(cfg, 'marketing_wallet', 'marketingWallet'));
    const onchainRitual = toB58(get(cfg, 'ritual_vault_wallet', 'ritualVaultWallet'));

    console.log('\nOn-chain Config:');
    console.log('  authority           :', toB58(get(cfg, 'authority', 'authority')));
    console.log('  founder_wallet      :', onchainFounder);
    console.log('  marketing_wallet    :', onchainMarketing);
    console.log('  ritual_vault_wallet :', onchainRitual);
    console.log('  tax_bps             :', get(cfg, 'tax_bps', 'taxBps'));
    console.log('  founder_bps         :', get(cfg, 'founder_bps', 'founderBps'));
    console.log('  marketing_bps       :', get(cfg, 'marketing_bps', 'marketingBps'));

    console.log('\nMatch vs .env:');
    console.log('  founder_fee_wallet  :', onchainFounder === envFounder ? '✅ matches' : `❌ mismatch (env=${envFounder})`);
    console.log('  marketing_wallet    :', onchainMarketing === envMarketing ? '✅ matches' : `❌ mismatch (env=${envMarketing})`);
    console.log('  ritual_vault_wallet :', onchainRitual === envRitual ? '✅ matches' : `❌ mismatch (env=${envRitual})`);

    const exemptArr = get(cfg, 'exempt', 'exempt') || [];
    const lpArr = get(cfg, 'lp_token_accounts', 'lpTokenAccounts') || [];
    const exempt = (exemptArr as any[]).map((k) => toB58(k));
    const lp = (lpArr as any[]).map((k) => toB58(k));

    console.log('\nExempt addresses:');
    if (!exempt.length) console.log('  (none)');
    else exempt.forEach((e: string, i: number) => console.log(`  [${i}] ${e}`));

    console.log('\nLP token accounts:');
    if (!lp.length) console.log('  (none)');
    else lp.forEach((e: string, i: number) => console.log(`  [${i}] ${e}`));
  } catch (err: any) {
    console.error('Failed to fetch config account.');
    if (err?.logs) console.error('Program logs:', err.logs);
    console.error('Error:', err?.message || err);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
