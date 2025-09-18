use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::AccountMeta, instruction::Instruction, program::invoke};
use core::convert::TryInto;

declare_id!("82a6CEiJSU8Mz48m5bDr28HfWaefWAQT9KggsJ64i66D");

// Constants for default token metadata (placeholders used by frontends; mint metadata lives off-chain/Metaplex)
pub const TOKEN_NAME: &str = "9LIVES";
pub const TOKEN_SYMBOL: &str = "9LIVES";
pub const TOKEN_DECIMALS: u8 = 9;
pub const TOTAL_SUPPLY: u64 = 999_000_000_000; // raw units at 9 decimals

// Default tax: 3% (300 bps) split 2% founder / 1% marketing
pub const DEFAULT_TAX_BPS: u16 = 300; // 3.00%
pub const DEFAULT_FOUNDER_BPS: u16 = 200; // 2.00%
pub const DEFAULT_MARKETING_BPS: u16 = 100; // 1.00%

// Storage sizing caps (adjust if you need more entries)
pub const MAX_EXEMPT_ADDRS: u32 = 64; // up to 64 exempt wallet owners
pub const MAX_LP_ACCOUNTS: u32 = 16;  // up to 16 LP destination token accounts

#[program]
pub mod nine_lives {
    use super::*;

    // Initialize the config PDA with authorities, defaults, and vector capacities
    pub fn initialize(
        ctx: Context<Initialize>,
        founder_wallet: Pubkey,
        marketing_wallet: Pubkey,
        ritual_vault_wallet: Pubkey,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.bump = ctx.bumps.config;
        cfg.authority = ctx.accounts.authority.key();
        cfg.founder_wallet = founder_wallet;
        cfg.marketing_wallet = marketing_wallet;
        cfg.ritual_vault_wallet = ritual_vault_wallet;
        cfg.tax_bps = DEFAULT_TAX_BPS;
        cfg.founder_bps = DEFAULT_FOUNDER_BPS;
        cfg.marketing_bps = DEFAULT_MARKETING_BPS;

        // Always exempt core wallets by default
        if !cfg.exempt.contains(&founder_wallet) { cfg.exempt.push(founder_wallet); }
        if !cfg.exempt.contains(&marketing_wallet) { cfg.exempt.push(marketing_wallet); }
        if !cfg.exempt.contains(&ritual_vault_wallet) { cfg.exempt.push(ritual_vault_wallet); }

        Ok(())
    }

    // Add an address to the tax-exempt list (authority only)
    pub fn add_exempt(ctx: Context<UpdateConfig>, addr: Pubkey) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        require_keys_eq!(ctx.accounts.authority.key(), cfg.authority, NineLivesError::Unauthorized);
        if !cfg.exempt.contains(&addr) {
            cfg.exempt.push(addr);
        }
        Ok(())
    }

    // Remove an address from the tax-exempt list (authority only)
    pub fn remove_exempt(ctx: Context<UpdateConfig>, addr: Pubkey) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        require_keys_eq!(ctx.accounts.authority.key(), cfg.authority, NineLivesError::Unauthorized);
        cfg.exempt.retain(|x| x != &addr);
        Ok(())
    }

    // Add a destination token account as an LP pool (authority only)
    pub fn add_lp_account(ctx: Context<UpdateConfig>, lp_token_account: Pubkey) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        require_keys_eq!(ctx.accounts.authority.key(), cfg.authority, NineLivesError::Unauthorized);
        if !cfg.lp_token_accounts.contains(&lp_token_account) {
            cfg.lp_token_accounts.push(lp_token_account);
        }
        Ok(())
    }

    // Remove a destination token account from LP set (authority only)
    pub fn remove_lp_account(ctx: Context<UpdateConfig>, lp_token_account: Pubkey) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        require_keys_eq!(ctx.accounts.authority.key(), cfg.authority, NineLivesError::Unauthorized);
        cfg.lp_token_accounts.retain(|x| x != &lp_token_account);
        Ok(())
    }

    // Transfer with optional sell tax (applies only when destination is an LP token account
    // and neither party is exempt). Uses direct Token-2022 CPI.
    pub fn transfer_with_tax(ctx: Context<TransferWithTax>, amount: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;

        // Basic invariant checks
        require!(amount > 0, NineLivesError::InvalidAmount);

        let from_acc = load_token_account_min(&ctx.accounts.from)?;
        let to_acc = load_token_account_min(&ctx.accounts.to)?;
        let founder_acc = load_token_account_min(&ctx.accounts.founder_token)?;
        let marketing_acc = load_token_account_min(&ctx.accounts.marketing_token)?;

        require_keys_eq!(ctx.accounts.mint.key(), from_acc.mint, NineLivesError::InvalidMint);
        require_keys_eq!(ctx.accounts.mint.key(), to_acc.mint, NineLivesError::InvalidMint);
        require_keys_eq!(ctx.accounts.mint.key(), founder_acc.mint, NineLivesError::InvalidMint);
        require_keys_eq!(ctx.accounts.mint.key(), marketing_acc.mint, NineLivesError::InvalidMint);
        require_keys_eq!(from_acc.owner, ctx.accounts.from_authority.key(), NineLivesError::Unauthorized);
        // Route fees only to configured founder/marketing owners
        require_keys_eq!(founder_acc.owner, cfg.founder_wallet, NineLivesError::Unauthorized);
        require_keys_eq!(marketing_acc.owner, cfg.marketing_wallet, NineLivesError::Unauthorized);

        // If either side is exempt, no tax is applied
        let from_owner = from_acc.owner;
        let to_owner = to_acc.owner;
        let either_exempt = cfg.is_exempt(&from_owner) || cfg.is_exempt(&to_owner);

        // Determine whether this is a sell: destination is a configured LP token account
        let is_sell = cfg.lp_token_accounts.contains(&ctx.accounts.to.key());

        if is_sell && !either_exempt {
            // Compute tax splits
            let tax_total = mul_bps(amount, cfg.tax_bps)?;
            let founder_fee = mul_bps(amount, cfg.founder_bps)?;
            let marketing_fee = mul_bps(amount, cfg.marketing_bps)?;
            require!(founder_fee + marketing_fee == tax_total, NineLivesError::TaxSplitMismatch);
            require!(amount > tax_total, NineLivesError::InsufficientNetAmount);
            let net = amount - tax_total;

            // 1) Transfer net to destination
            let ix_net = ix_transfer(
                ctx.accounts.token_program.key(),
                ctx.accounts.from.key(),
                ctx.accounts.to.key(),
                ctx.accounts.from_authority.key(),
                net,
            );
            invoke(&ix_net, &[
                ctx.accounts.from.to_account_info(),
                ctx.accounts.to.to_account_info(),
                ctx.accounts.from_authority.to_account_info(),
            ])?;

            // 2) Transfer founder fee
            let ix_founder = ix_transfer(
                ctx.accounts.token_program.key(),
                ctx.accounts.from.key(),
                ctx.accounts.founder_token.key(),
                ctx.accounts.from_authority.key(),
                founder_fee,
            );
            invoke(&ix_founder, &[
                ctx.accounts.from.to_account_info(),
                ctx.accounts.founder_token.to_account_info(),
                ctx.accounts.from_authority.to_account_info(),
            ])?;

            // 3) Transfer marketing fee
            let ix_marketing = ix_transfer(
                ctx.accounts.token_program.key(),
                ctx.accounts.from.key(),
                ctx.accounts.marketing_token.key(),
                ctx.accounts.from_authority.key(),
                marketing_fee,
            );
            invoke(&ix_marketing, &[
                ctx.accounts.from.to_account_info(),
                ctx.accounts.marketing_token.to_account_info(),
                ctx.accounts.from_authority.to_account_info(),
            ])?;
        } else {
            // No tax path: normal transfer
            let ix = ix_transfer(
                ctx.accounts.token_program.key(),
                ctx.accounts.from.key(),
                ctx.accounts.to.key(),
                ctx.accounts.from_authority.key(),
                amount,
            );
            invoke(&ix, &[
                ctx.accounts.from.to_account_info(),
                ctx.accounts.to.to_account_info(),
                ctx.accounts.from_authority.to_account_info(),
            ])?;
        }

        Ok(())
    }

    // Manual burn callable only by the Ritual Vault wallet; burns from a token account owned by it
    pub fn burn(ctx: Context<BurnCtx>, amount: u64) -> Result<()> {
        require!(amount > 0, NineLivesError::InvalidAmount);
        let cfg = &ctx.accounts.config;
        require_keys_eq!(ctx.accounts.ritual_vault.key(), cfg.ritual_vault_wallet, NineLivesError::Unauthorized);
        // Token account must be owned by ritual_vault signer
        let vault_acc = load_token_account_min(&ctx.accounts.vault_token)?;
        require_keys_eq!(vault_acc.owner, ctx.accounts.ritual_vault.key(), NineLivesError::Unauthorized);
        require_keys_eq!(vault_acc.mint, ctx.accounts.mint.key(), NineLivesError::InvalidMint);

        let ix = ix_burn(
            ctx.accounts.token_program.key(),
            ctx.accounts.vault_token.key(),
            ctx.accounts.mint.key(),
            ctx.accounts.ritual_vault.key(),
            amount,
        );
        invoke(&ix, &[
            ctx.accounts.vault_token.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.ritual_vault.to_account_info(),
        ])?;
        Ok(())
    }

    // Lock the mint authority by setting it to None. Current mint authority must sign.
    pub fn lock_mint_authority(ctx: Context<LockMintAuthority>) -> Result<()> {
        let ix = ix_set_mint_authority_none(
            ctx.accounts.token_program.key(),
            ctx.accounts.mint.key(),
            ctx.accounts.mint_authority.key(),
        );
        invoke(&ix, &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
        ])?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Config::BASE_SIZE + Config::vec_space(MAX_EXEMPT_ADDRS, MAX_LP_ACCOUNTS),
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
pub struct TransferWithTax<'info> {
    // Payer/sender authority of the source token account
    pub from_authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    // Token-2022 accounts (unchecked, validated at runtime)
    /// CHECK: validated at runtime (we only read mint/owner or use in CPI)
    #[account(mut)]
    pub from: UncheckedAccount<'info>,
    /// CHECK: validated at runtime (we only read mint/owner or use in CPI)
    #[account(mut)]
    pub to: UncheckedAccount<'info>,
    /// CHECK: validated at runtime (we only read mint/owner or use in CPI)
    #[account(mut)]
    pub founder_token: UncheckedAccount<'info>,
    /// CHECK: validated at runtime (we only read mint/owner or use in CPI)
    #[account(mut)]
    pub marketing_token: UncheckedAccount<'info>,
    /// CHECK: validated at runtime (we only read mint/owner or use in CPI)
    pub mint: UncheckedAccount<'info>,
    /// CHECK: validated at runtime (we only read mint/owner or use in CPI)
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct BurnCtx<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    pub ritual_vault: Signer<'info>,
    /// CHECK: validated at runtime (we only read mint/owner or use in CPI)
    #[account(mut)]
    pub vault_token: UncheckedAccount<'info>,
    /// CHECK: validated at runtime (we only read mint/owner or use in CPI)
    pub mint: UncheckedAccount<'info>,
    /// CHECK: validated at runtime (we only read mint/owner or use in CPI)
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct LockMintAuthority<'info> {
    #[account(mut)]
    /// CHECK: validated at runtime (we only read mint/owner or use in CPI)
    pub mint: UncheckedAccount<'info>,
    pub mint_authority: Signer<'info>,
    /// CHECK: validated at runtime (we only read mint/owner or use in CPI)
    pub token_program: UncheckedAccount<'info>,
}

// Minimal helper to read just the mint and owner from a Token-2022 token account
struct MinTokenAccount {
    mint: Pubkey,
    owner: Pubkey,
}

fn load_token_account_min(acc: &AccountInfo) -> Result<MinTokenAccount> {
    let data = acc.try_borrow_data().map_err(|_| NineLivesError::InvalidMint)?;
    if data.len() < 64 {
        return Err(NineLivesError::InvalidMint.into());
    }
    let mint = Pubkey::new_from_array(data[0..32].try_into().unwrap());
    let owner = Pubkey::new_from_array(data[32..64].try_into().unwrap());
    Ok(MinTokenAccount { mint, owner })
}

// Minimal instruction builders for Token-2022
// Transfer
fn ix_transfer(program_id: Pubkey, from: Pubkey, to: Pubkey, authority: Pubkey, amount: u64) -> Instruction {
    let mut data = Vec::with_capacity(1 + 8);
    data.push(3u8); // Transfer
    data.extend_from_slice(&amount.to_le_bytes());
    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(from, false),
            AccountMeta::new(to, false),
            AccountMeta::new_readonly(authority, true),
        ],
        data,
    }
}

// Burn
fn ix_burn(program_id: Pubkey, account: Pubkey, mint: Pubkey, authority: Pubkey, amount: u64) -> Instruction {
    let mut data = Vec::with_capacity(1 + 8);
    data.push(8u8); // Burn
    data.extend_from_slice(&amount.to_le_bytes());
    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(account, false),
            AccountMeta::new(mint, false),
            AccountMeta::new_readonly(authority, true),
        ],
        data,
    }
}

// SetAuthority to None for MintTokens
fn ix_set_mint_authority_none(program_id: Pubkey, account_or_mint: Pubkey, current_authority: Pubkey) -> Instruction {
    // SetAuthority layout: tag(6) | authority_type(u8) | option(u8=0 None/1 Some) | new_authority(pubkey if Some)
    let data = vec![6u8, 0u8, 0u8]; // 0 = MintTokens, None
    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(account_or_mint, false),
            AccountMeta::new_readonly(current_authority, true),
        ],
        data,
    }
}

#[account]
pub struct Config {
    pub bump: u8,
    pub authority: Pubkey,
    pub founder_wallet: Pubkey,
    pub marketing_wallet: Pubkey,
    pub ritual_vault_wallet: Pubkey,
    pub tax_bps: u16,
    pub founder_bps: u16,
    pub marketing_bps: u16,
    pub exempt: Vec<Pubkey>,          // tax-exempt wallet owners
    pub lp_token_accounts: Vec<Pubkey>, // LP destination token accounts
}

impl Config {
    // Fixed portion of account size (without vec contents)
    pub const BASE_SIZE: usize = 1 + 32 + 32 + 32 + 32 + 2 + 2 + 2 + 4 + 4; // vec headers (4 each)

    pub fn vec_space(exempt_cap: u32, lp_cap: u32) -> usize {
        (exempt_cap as usize * 32) + (lp_cap as usize * 32)
    }

    pub fn is_exempt(&self, owner: &Pubkey) -> bool {
        owner == &self.founder_wallet
            || owner == &self.marketing_wallet
            || owner == &self.ritual_vault_wallet
            || self.exempt.contains(owner)
    }
}

// Errors
#[error_code]
pub enum NineLivesError {
    #[msg("Unauthorized")] 
    Unauthorized,
    #[msg("Invalid amount")] 
    InvalidAmount,
    #[msg("Invalid mint for token account")] 
    InvalidMint,
    #[msg("Tax split mismatch")] 
    TaxSplitMismatch,
    #[msg("Insufficient amount after tax")] 
    InsufficientNetAmount,
    #[msg("Math overflow")] 
    MathOverflow,
}

// Helpers
fn mul_bps(amount: u64, bps: u16) -> Result<u64> {
    // amount * bps / 10_000 with overflow checks
    amount
        .checked_mul(bps as u64)
        .ok_or::<anchor_lang::error::Error>(NineLivesError::MathOverflow.into())?
        .checked_div(10_000)
        .ok_or::<anchor_lang::error::Error>(NineLivesError::MathOverflow.into())
}
