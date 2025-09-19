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
  const PHASES: { key: 'TGE' | 'Month1' | 'Month2' | 'Month3' | 'Month4'; label: string; pct: number }[] = [
    { key: 'TGE', label: 'TGE', pct: 0.15 },
    { key: 'Month1', label: 'Month1', pct: 0.15 },
    { key: 'Month2', label: 'Month2', pct: 0.20 },
    { key: 'Month3', label: 'Month3', pct: 0.25 },
    { key: 'Month4', label: 'Month4', pct: 0.25 },
  ]

  const computeTokensForPhase = (phase: string): number => {
    const pct = PHASES.find(p => p.key === phase)?.pct ?? 0
    const base = typeof claimRecord?.tokenAmount === 'number' ? claimRecord.tokenAmount : (totalClaimable ?? 0)
    return Math.floor(base * pct)
  }

  const getClaimedSet = (): Set<string> => {
    const list = Array.isArray(claimRecord?.claimedPhases) ? claimRecord.claimedPhases : []
    return new Set(list.map((p: any) => p?.phase).filter(Boolean))
  }

  const getPhaseTokensFromRecord = (phase: string): number => {
    const list = Array.isArray(claimRecord?.claimedPhases) ? claimRecord.claimedPhases : []
    const found = list.find((p: any) => p?.phase === phase)
    if (found && typeof found.tokens === 'number') return found.tokens
    return computeTokensForPhase(phase)
  }

  const totalClaimedFromRecord = (): number => {
    const claimed = Array.from(getClaimedSet())
    return claimed.reduce((sum, ph) => sum + getPhaseTokensFromRecord(ph), 0)
  }

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

  const submitClaim = async (phase: 'TGE' | 'Month1' | 'Month2' | 'Month3' | 'Month4' = 'TGE') => {
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
          phase,
          claimedNFTs: nfts,
          tokenAmount: totalClaimable,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Claim failed')

      setClaimSuccess(true)
      if (data?.phase && typeof data?.tokens === 'number') setLastClaim({ phase: data.phase, tokens: data.tokens })
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
                  {/* Summary Section */}
                  <div className="bg-zinc-800 border border-zinc-700 rounded-md p-3">
                    <p className="text-sm text-gray-300">Total Allocation</p>
                    <p className="text-xl font-semibold">{(claimRecord?.tokenAmount ?? totalClaimable).toLocaleString()} $9LIVES</p>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div className="bg-zinc-900 rounded p-2 border border-zinc-700">
                        <p className="text-xs text-gray-400">Total Claimed</p>
                        <p className="font-semibold text-green-400">{totalClaimedFromRecord().toLocaleString()}</p>
                      </div>
                      <div className="bg-zinc-900 rounded p-2 border border-zinc-700">
                        <p className="text-xs text-gray-400">Remaining</p>
                        <p className="font-semibold text-yellow-400">{Math.max(0, (claimRecord?.tokenAmount ?? totalClaimable) - totalClaimedFromRecord()).toLocaleString()}</p>
                      </div>
                    </div>
                    {lastClaim && (
                      <p className="mt-2 text-sm text-lime-300 font-mono">Latest Claim: {lastClaim.phase} — {lastClaim.tokens.toLocaleString()} tokens</p>
                    )}
                  </div>

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

                  {/* Stacked Phase Buttons */}
                  <div className="mt-4 flex flex-col gap-2">
                    {PHASES.map(({ key, label }) => {
                      const claimedSet = getClaimedSet()
                      const isClaimed = claimedSet.has(key)
                      const prerequisiteMet = key === 'TGE' || (key === 'Month1' && claimedSet.has('TGE')) || (key === 'Month2' && claimedSet.has('Month1')) || (key === 'Month3' && claimedSet.has('Month2')) || (key === 'Month4' && claimedSet.has('Month3'))
                      const tokensForPhase = getPhaseTokensFromRecord(key)
                      const disabled = isSubmitting || !solanaAddress.trim() || isClaimed || !prerequisiteMet
                      const stateLabel = isClaimed
                        ? `✅ ${label}: Claimed (${tokensForPhase.toLocaleString()})`
                        : prerequisiteMet
                        ? `Claim ${label} (${tokensForPhase.toLocaleString()})`
                        : `⏳ ${label}: Available later`

                      const baseClass = 'w-full px-4 py-3 rounded-lg font-semibold'
                      const className = isClaimed
                        ? `${baseClass} bg-zinc-700 text-zinc-300 cursor-not-allowed`
                        : prerequisiteMet
                        ? `${baseClass} bg-lime-600 hover:bg-lime-700 text-white`
                        : `${baseClass} bg-zinc-800 text-zinc-400 cursor-not-allowed`

                      return (
                        <button
                          key={key}
                          onClick={() => submitClaim(key)}
                          disabled={disabled}
                          className={className}
                        >
                          {isSubmitting && !isClaimed ? 'Submitting...' : stateLabel}
                        </button>
                      )
                    })}
                  </div>

                  {claimSuccess && (
                    <p className="text-green-400 mt-3 font-mono">
                      ✅ Successfully submitted claim.
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

                  {/* Existing vesting schedule stays visible */}
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
