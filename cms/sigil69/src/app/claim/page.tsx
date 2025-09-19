'use client'

import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import VestingSchedule from '@/components/vesting/VestingSchedule'
interface NftClaimInfo {
  tokenId: number
  rank: number
  tier: string
  reward: number
}

export default function ClaimPage() {
  const [address, setAddress] = useState<string | null>(null)
  const [solanaAddress, setSolanaAddress] = useState<string>('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nfts, setNfts] = useState<NftClaimInfo[]>([])
  const [totalClaimable, setTotalClaimable] = useState<number | null>(null)
  const [claimSuccess, setClaimSuccess] = useState<boolean>(false)
  const [claimRecord, setClaimRecord] = useState<any>(null) // ✅ new
  const [lastClaim, setLastClaim] = useState<{ phase: string; tokens: number } | null>(null)

  const connectWallet = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      if (!window.ethereum) throw new Error('MetaMask not installed')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])
      setAddress(accounts[0])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsConnecting(false)
    }
  }

  const fetchEligibility = async () => {
    if (!address) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/verify-nft-holder?address=${address}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch NFT data')
      }

      setNfts(data.ownedTokens || [])
      setTotalClaimable(data.totalClaimable || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchClaimRecord = async () => {
    if (!address) return
    try {
      const res = await fetch(`/api/get-claim-record?address=${address}`)
      const data = await res.json()
      if (res.ok && data?.doc) {
        setClaimRecord(data.doc)
      }
    } catch (err: any) {
      console.error('❌ Failed to fetch claim record:', err.message)
    }
  }

  const submitClaim = async () => {
    if (!address || !solanaAddress || !nfts.length || !totalClaimable) {
      setError('Missing wallet info or no eligible NFTs')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/claim-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ethAddress: address,
          solAddress: solanaAddress,
          claimedNFTs: nfts,
          tokenAmount: totalClaimable,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Claim failed')

      setClaimSuccess(true)
      if (data?.phase && typeof data?.tokens === 'number') {
        setLastClaim({ phase: data.phase, tokens: data.tokens })
      }
      fetchClaimRecord() // ✅ refresh claim info after claim
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (address) {
      fetchEligibility()
      fetchClaimRecord() // ✅ also fetch claim record on connect
    }
  }, [address])

  return (
    <main className="min-h-screen bg-black text-white p-10 font-sans">
      <h1 className="text-4xl mb-6">🎯 Claim Your $9LIVES Airdrop</h1>

      {address ? (
        <div className="bg-zinc-900 p-6 rounded-lg border border-zinc-700 max-w-xl space-y-4">
          <p className="text-sm">✅ Connected ETH Address:</p>
          <p className="font-mono text-lime-400 break-words">{address}</p>

          <button
            onClick={fetchEligibility}
            disabled={isLoading}
            className="bg-lime-600 hover:bg-lime-700 px-4 py-2 rounded-lg font-semibold"
          >
            🔁 {isLoading ? 'Refreshing...' : 'Refresh Eligibility'}
          </button>

          {isLoading && <p className="text-yellow-400">🔍 Checking eligibility...</p>}
          {error && <p className="text-red-500 font-mono">⚠️ {error}</p>}

          {!isLoading && totalClaimable !== null && (
            <>
              {nfts.length > 0 ? (
                <div>
                  <p className="text-lime-400 font-mono">
                    ✅ You can claim: <strong>{totalClaimable.toLocaleString()}</strong> $9LIVES
                  </p>

                  <label className="block mt-4">
                    <span className="text-sm text-gray-300">Enter Solana Wallet Address:</span>
                    <input
                      type="text"
                      placeholder="Eg. 9wFU..."
                      className="mt-1 w-full px-3 py-2 rounded bg-zinc-800 text-white border border-zinc-600"
                      value={solanaAddress}
                      onChange={(e) => setSolanaAddress(e.target.value)}
                    />
                  </label>

                  <button
                    onClick={submitClaim}
                    disabled={isSubmitting || !solanaAddress.trim()}
                    className="mt-4 bg-lime-600 hover:bg-lime-700 px-6 py-3 rounded-lg text-white font-semibold"
                  >
                    {isSubmitting ? 'Submitting...' : 'Claim Now (TGE)'}
                  </button>

                  {claimSuccess && (
                    <p className="text-green-400 mt-3 font-mono">
                      ✅ Successfully submitted claim. Awaiting token drop.
                    </p>
                  )}

                  <h2 className="mt-6 text-xl font-semibold">🎁 Eligible NFTs:</h2>
                  <ul className="space-y-2 mt-2 max-h-[300px] overflow-y-auto border-t border-zinc-800 pt-2">
                    {nfts.map((nft) => (
                      <li key={nft.tokenId} className="border border-zinc-700 p-3 rounded">
                        <p className="text-lime-300">Token #{nft.tokenId} — {nft.tier}</p>
                        <p>🏅 Rank: {nft.rank} — 🪙 Reward: {nft.reward.toLocaleString()} $9LIVES</p>
                      </li>
                    ))}
                  </ul>

                  {/* ✅ Show vesting schedule if available */}
                  {claimRecord && (
                    <div className="mt-6">
                      <VestingSchedule claim={claimRecord} />
                    </div>
                  )}

                  {/* ✅ Simple per-phase status */}
                  <div className="mt-6 border-t border-zinc-800 pt-4">
                    <h3 className="text-lg font-semibold mb-2">Vesting Phases</h3>
                    <ul className="space-y-1">
                      {['TGE', 'Month1', 'Month2', 'Month3', 'Month4'].map((p) => {
                        // Determine if phase claimed
                        const claimedList = Array.isArray(claimRecord?.claimedPhases) ? claimRecord.claimedPhases : []
                        const found = claimedList.find((x: any) => x?.phase === p)
                        // Prefer stored tokens, else compute fallback from claimRecord.claimedNFTs
                        let tokens: number | null = typeof found?.tokens === 'number' ? found.tokens : null
                        if (tokens == null && claimRecord?.claimedNFTs) {
                          const pctMap: Record<string, number> = { TGE: 0.15, Month1: 0.15, Month2: 0.2, Month3: 0.25, Month4: 0.25 }
                          const pct = pctMap[p] ?? 0
                          try {
                            tokens = (Array.isArray(claimRecord.claimedNFTs) ? claimRecord.claimedNFTs : []).reduce((sum: number, n: any) => {
                              const full = typeof n.fullAllocation === 'number'
                                ? n.fullAllocation
                                : (typeof n.fullAmount === 'number'
                                  ? n.fullAmount
                                  : (typeof n.allocation === 'number' ? Math.round(n.allocation / 0.15) : 0))
                              return sum + Math.floor(full * pct)
                            }, 0)
                          } catch {}
                        }
                        const label = found ? `✅ ${p}: ${tokens != null ? tokens.toLocaleString() : 'claimed'}` : `⏳ ${p}: Pending`
                        return (
                          <li key={p} className="font-mono text-sm text-zinc-200">{label}</li>
                        )
                      })}
                    </ul>
                    {lastClaim && (
                      <p className="text-green-400 mt-2 font-mono">Latest: ✅ {lastClaim.phase} — {lastClaim.tokens.toLocaleString()} claimed</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-red-400 font-mono">🚫 No eligible NFTs found.</p>
              )}
            </>
          )}
        </div>
      ) : (
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="mt-4 bg-lime-600 hover:bg-lime-700 px-6 py-3 rounded-lg text-white font-semibold"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
    </main>
  )
}
