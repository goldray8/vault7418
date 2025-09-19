import { NextApiRequest, NextApiResponse } from 'next'
import { initPayload } from '../../../lib/initPayload'
import rarityData from '../../../data/rarity-snapshot.json'
import ownerSnapshot from '../../../data/nft-owners.json'
import blockedWallets from '../../../data/blocked-wallets.json'

const BLOCKED_WALLETS = new Set(blockedWallets.map(addr => addr.toLowerCase()))
const CURRENT_PHASE = 'TGE' // Could be 'TGE', 'Month1', etc.
const VESTING_PERCENT = 0.15 // 15% unlocked for TGE

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
  const { ethWallet, solWallet } = req.body

  if (!ethWallet || !solWallet) {
    return res.status(400).json({ error: 'Missing wallet information' })
  }

  const lowerEth = ethWallet.toLowerCase()
  if (BLOCKED_WALLETS.has(lowerEth)) {
    return res.status(403).json({ error: 'Wallet is not eligible for claim' })
  }

  try {
    // ✅ Check if already claimed this phase
    const existingClaims = await payload.find({
      collection: 'claims',
      where: {
        and: [
          { ethWallet: { equals: lowerEth } },
          { phase: { equals: CURRENT_PHASE } },
        ],
      },
    })

    if (existingClaims.docs.length > 0) {
      return res.status(409).json({ error: `Already claimed ${CURRENT_PHASE}` })
    }

    // ✅ Find eligible NFTs
    const ownedTokenIds = Object.entries(ownerSnapshot)
      .filter(([tokenId, owner]) => owner.toLowerCase() === lowerEth)
      .map(([tokenId]) => parseInt(tokenId))

    const eligible = ownedTokenIds
      .map((tokenId) => {
        const rarity = rarityData.find((r) => r.tokenId === tokenId)
        const rank = rarity?.rank ?? Number.MAX_SAFE_INTEGER // fallback -> Common
        const { tier, amount } = getReward(rank)
        return {
          tokenId,
          rarity: tier,
          allocation: Math.floor(amount * VESTING_PERCENT), // TGE unlocked
          fullAmount: amount, // full per-NFT allocation
        }
      })

    const totalAmount = eligible.reduce((sum, nft) => sum + nft.fullAmount, 0)

    if (eligible.length === 0 || totalAmount === 0) {
      return res.status(403).json({ error: 'No eligible NFTs found' })
    }

    // ✅ Store in Payload CMS
    await payload.create({
      collection: 'claims',
      data: {
        ethWallet: ethWallet.toLowerCase(),
        solWallet: solWallet.toLowerCase(),
        claimedNFTs: eligible.map((n) => ({
          tokenId: n.tokenId,
          rarity: n.rarity,
          allocation: n.allocation,
          fullAmount: n.fullAmount,
        })),
        tokenAmount: totalAmount, // store full per-NFT sum; UI cells compute vesting slices
        phase: CURRENT_PHASE,
        status: 'pending',
      },
    })

    return res.status(200).json({
      success: true,
      nftCount: eligible.length,
      totalTokens: totalAmount,
      phase: CURRENT_PHASE,
    })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to process claim' })
  }
}
