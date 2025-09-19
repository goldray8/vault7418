import { NextApiRequest, NextApiResponse } from 'next'
import { initPayload } from '../../../lib/initPayload'
import rarityData from '../../../data/rarity-snapshot.json'
import ownerSnapshot from '../../../data/nft-owners.json'
import blockedWallets from '../../../data/blocked-wallets.json'

const BLOCKED_WALLETS = new Set(blockedWallets.map(addr => addr.toLowerCase()))
const VESTING_PERCENT = 0.15 // 15% unlocked for TGE
const PHASES: Record<string, number> = {
  TGE: 0.15,
  Month1: 0.15,
  Month2: 0.20,
  Month3: 0.25,
  Month4: 0.25,
}
const PHASE_ORDER = ['TGE', 'Month1', 'Month2', 'Month3', 'Month4'] as const

const getReward = (rank: number) => {
  // rank === 1..3 => Legendary
  if (rank >= 1 && rank <= 3) {
    return { tier: '🔴 Legendary', amount: 400_000_000 }
  }
  // 4..33 => Mythic (next 30 ranks)
  if (rank <= 33) {
    return { tier: '🔴 Mythic', amount: 200_000_000 }
  }
  // 34..167 => Ultra Rare (134 tokens)
  if (rank <= 167) {
    return { tier: '🟠 Ultra Rare', amount: 85_000_000 }
  }
  // 168..499 => Rare (332 tokens)
  if (rank <= 499) {
    return { tier: '🟡 Rare', amount: 60_000_000 }
  }
  // 500..1166 => Uncommon (667 tokens)
  if (rank <= 1166) {
    return { tier: '🟢 Uncommon', amount: 30_000_000 }
  }
  // fallback => Common
  return { tier: '🔵 Common', amount: 20_430_000 }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let payload
  try {
    payload = await initPayload()
  } catch (err) {
    console.error('❌ Payload init failed:', err)
    return res.status(500).json({ error: 'Payload initialization failed' })
  }
  const { ethAddress, solAddress } = req.body || {}
  let phase: string = (req.body && typeof req.body.phase === 'string' ? req.body.phase : 'TGE')
  if (!Object.prototype.hasOwnProperty.call(PHASES, phase)) {
    return res.status(400).json({ error: 'Invalid phase. Expected one of TGE, Month1, Month2, Month3, Month4.' })
  }

  if (!ethAddress || !solAddress) {
    console.error('Claim request missing fields:', req.body)
    return res.status(400).json({ error: 'Missing wallet information. Expected { ethAddress, solAddress }' })
  }

  console.log('Claim request received:', { ethAddress, solAddress })

  const lowerEth = ethAddress.toLowerCase()
  if (BLOCKED_WALLETS.has(lowerEth)) {
    return res.status(403).json({ error: 'Wallet is not eligible for claim' })
  }

  try {
    // Check for existing claim doc for this wallet
    const existing = await payload.find({
      collection: 'claims',
      where: { ethWallet: { equals: lowerEth } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      const doc = existing.docs[0] as any
      const claimedPhases: Array<{ phase: string; claimedAt?: string; tx?: string | null }> = Array.isArray(doc.claimedPhases) ? doc.claimedPhases : []

      // Prevent duplicate claim for the same phase
      if (claimedPhases.some((p) => p.phase === phase)) {
        return res.status(409).json({ error: 'Phase already claimed' })
      }

      // Enforce sequential vesting: all previous phases must be claimed
      const phaseIndex = PHASE_ORDER.indexOf(phase as any)
      if (phaseIndex > 0) {
        const required = new Set(PHASE_ORDER.slice(0, phaseIndex))
        const have = new Set(claimedPhases.map((p) => p.phase))
        for (const reqPhase of required) {
          if (!have.has(reqPhase)) {
            return res.status(400).json({ error: `Phase ${phase} requires prior phase ${reqPhase}` })
          }
        }
      }

      // Compute tokens for this phase from stored fullAllocation
      const pct = PHASES[phase]
      const tokens = (Array.isArray(doc.claimedNFTs) ? doc.claimedNFTs : []).reduce((sum: number, n: any) => {
        const full = typeof n.fullAllocation === 'number' ? n.fullAllocation : (typeof n.fullAmount === 'number' ? n.fullAmount : (typeof n.allocation === 'number' ? Math.round(n.allocation / VESTING_PERCENT) : 0))
        return sum + Math.floor(full * pct)
      }, 0)

      const updated = await payload.update({
        collection: 'claims',
        id: doc.id,
        data: {
          phase, // keep latest claimed phase for convenience
          claimedPhases: [
            ...claimedPhases,
            { phase, claimedAt: new Date().toISOString(), tx: null },
          ],
        },
      })

      return res.status(200).json({ success: true, phase, tokens })
    }

    // No existing doc: only TGE is allowed as the first claim
    if (phase !== 'TGE') {
      return res.status(400).json({ error: 'Phase requires previous claims. Start with TGE.' })
    }

    // Find eligible NFTs for first-time claimant
    const ownedTokenIds = Object.entries(ownerSnapshot)
      .filter(([, owner]) => owner.toLowerCase() === lowerEth)
      .map(([tokenId]) => parseInt(tokenId))

    const eligible = ownedTokenIds.map((tokenId) => {
      const rarity = rarityData.find((r) => r.tokenId === tokenId)
      const rank = rarity?.rank ?? Number.MAX_SAFE_INTEGER // fallback -> Common
      const { tier, amount } = getReward(rank)
      return {
        tokenId,
        rarity: tier,
        allocation: Math.floor(amount * VESTING_PERCENT), // TGE unlocked
        fullAllocation: amount, // full per-NFT allocation
      }
    })

    const totalAmount = eligible.reduce((sum, nft) => sum + nft.fullAllocation, 0)

    if (eligible.length === 0 || totalAmount === 0) {
      return res.status(403).json({ error: 'No eligible NFTs found' })
    }

    // Tokens for requested phase (TGE here)
    const tokens = eligible.reduce((sum, n) => sum + Math.floor(n.fullAllocation * PHASES['TGE']), 0)

    // Create initial claim doc
    await payload.create({
      collection: 'claims',
      data: {
        ethWallet: ethAddress.toLowerCase(),
        solWallet: solAddress.toLowerCase(),
        claimedNFTs: eligible.map((n) => ({
          tokenId: n.tokenId,
          rarity: n.rarity,
          allocation: n.allocation,
          fullAllocation: n.fullAllocation,
        })),
        tokenAmount: totalAmount, // full per-NFT sum
        phase: 'TGE',
        claimedPhases: [{ phase: 'TGE', claimedAt: new Date().toISOString(), tx: null }],
        status: 'pending',
      },
    })

    return res.status(200).json({ success: true, phase: 'TGE', tokens })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to process claim' })
  }
}
