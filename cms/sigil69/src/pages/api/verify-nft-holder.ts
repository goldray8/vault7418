// pages/api/verify-nft-holder.ts

import { NextApiRequest, NextApiResponse } from 'next'
import rarityData from '../../../data/rarity-snapshot.json'
import ownerSnapshot from '../../../data/nft-owners.json'
import blockedWallets from '../../../data/blocked-wallets.json'

const BLOCKED_WALLETS = new Set(blockedWallets.map(addr => addr.toLowerCase()))

// use exact numbers from canonical table above
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
  const { address } = req.query

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing address' })
  }

  const normalizedAddress = address.toLowerCase()

  if (BLOCKED_WALLETS.has(normalizedAddress)) {
    console.warn(`⛔ Blocked wallet tried to claim: ${normalizedAddress}`)
    return res.status(403).json({ eligible: false, reason: 'Wallet ineligible (flagged).' })
  }

  // Get all tokenIds owned by this address
  const ownedTokenIds = Object.entries(ownerSnapshot)
    .filter(([, owner]) => owner.toLowerCase() === normalizedAddress)
    .map(([tokenId]) => parseInt(tokenId))

  if (ownedTokenIds.length === 0) {
    return res.status(404).json({ eligible: false, reason: 'No NFTs found for this wallet.' })
  }

  const ownedTokens = ownedTokenIds
    .map((tokenId) => {
      const rarityEntry = rarityData.find((r) => r.tokenId === tokenId)
      const rank = rarityEntry?.rank ?? Number.MAX_SAFE_INTEGER // fallback -> Common
      const { tier, amount } = getReward(rank)
      return {
        tokenId,
        rank,
        tier,
        reward: amount,
      }
    })

  const totalClaimable = ownedTokens.reduce((sum, t) => sum + t.reward, 0)

  return res.status(200).json({
    address,
    ownedTokens,
    totalClaimable,
  })
}
