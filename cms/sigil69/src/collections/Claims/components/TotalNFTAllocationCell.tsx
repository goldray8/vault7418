import React from 'react'

type NFT = { allocation?: number; fullAmount?: number; fullAllocation?: number }

export default function TotalNFTAllocationCell({ rowData }: { rowData: any }) {
  const nfts: NFT[] = Array.isArray(rowData?.claimedNFTs) ? rowData.claimedNFTs : []
  const sumAlloc = nfts.reduce((sum, n) => sum + (typeof n.allocation === 'number' ? n.allocation : 0), 0)
  const sumFull = nfts.reduce((sum, n) => {
    const full = typeof n.fullAllocation === 'number' ? n.fullAllocation : (typeof n.fullAmount === 'number' ? n.fullAmount : 0)
    return sum + full
  }, 0)
  // Prefer explicit fullAmount if present; otherwise infer from 15% TGE
  const inferred = sumFull > 0 ? sumFull : Math.round(sumAlloc / 0.15)
  const formatted = inferred.toLocaleString()
  return <span>{formatted}</span>
}
