/**
 * scripts/send-initialize.ts
 *
 * Usage:
 *   - Fill .env with required wallet addresses.
 *   - Ensure your wallet is configured (ANCHOR_WALLET or default ~/.config/solana/id.json).
 *   - Run: `anchor run send_init` (see Anchor.toml script).
 *
 * Behavior:
 *   - Loads variables from .env (FOUNDER_FEE_WALLET, MARKETING_WALLET, RITUAL_VAULT_WALLET).
 *   - Sets provider to Devnet via AnchorProvider.env().
 *   - Derives the config PDA and sends initialize.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as anchor from '@coral-xyz/anchor';

// Lightweight .env loader (avoids external deps)
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
  // Load env vars from .env
  loadDotEnv();

  const founderFeeWallet = process.env.FOUNDER_FEE_WALLET;
  const marketingWallet = process.env.MARKETING_WALLET;
  const ritualVaultWallet = process.env.RITUAL_VAULT_WALLET;

  if (!founderFeeWallet || !marketingWallet || !ritualVaultWallet) {
    throw new Error(
      'Missing one or more required env vars: FOUNDER_FEE_WALLET, MARKETING_WALLET, RITUAL_VAULT_WALLET'
    );
  }

  // Force Devnet unless user overrides
  if (!process.env.ANCHOR_PROVIDER_URL) {
    process.env.ANCHOR_PROVIDER_URL = 'https://api.devnet.solana.com';
  }

  // Initialize provider and program
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Prefer named program; fallback to the first program in workspace
  const workspaceAny: any = (anchor as any).workspace;
  let program: anchor.Program;
  if (workspaceAny && workspaceAny.NineLives) {
    program = workspaceAny.NineLives as anchor.Program;
  } else {
    const all = Object.values(workspaceAny || {});
    if (!all.length) throw new Error('No programs found in anchor.workspace. Did you build the IDL?');
    program = all[0] as anchor.Program;
  }

  // Compute config PDA
  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    program.programId
  );

  // Send initialize
  try {
    const txSig = await program.methods
      .initialize(
        new anchor.web3.PublicKey(founderFeeWallet),
        new anchor.web3.PublicKey(marketingWallet),
        new anchor.web3.PublicKey(ritualVaultWallet)
      )
      .accounts({
        authority: (provider.wallet as anchor.Wallet).publicKey,
        config: configPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Successfully initialized config PDA at:', configPda.toBase58());
    console.log('📦 Tx signature:', txSig);
  } catch (err: any) {
    console.error('❌ Failed to initialize config PDA.');
    if (err?.logs) console.error('Program logs:', err.logs);
    console.error('Error:', err?.message || err);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

