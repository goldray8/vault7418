'use client'
import React, { useMemo } from 'react'

type PhaseItem = {
  phase: string
  claimedAt?: string
  tokens?: number
  tx?: string
}

type NFT = {
  allocation?: number
  fullAllocation?: number
  fullAmount?: number
}

const PHASES: Record<string, number> = {
  TGE: 0.15,
  Month1: 0.15,
  Month2: 0.20,
  Month3: 0.25,
  Month4: 0.25,
}

function isHexTx(v?: string) {
  return !!v && v.startsWith('0x') && v.length >= 10
}

function isLikelyBase58(v?: string) {
  return !!v && /^[1-9A-HJ-NP-Za-km-z]{20,}$/.test(v)
}

function fmtDateTime(value?: string) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function computeTokensForPhase(phase: string, claimedNFTs: NFT[]): number {
  const pct = PHASES[phase] ?? 0
  return claimedNFTs.reduce((sum, n) => {
    const full = typeof n.fullAllocation === 'number'
      ? n.fullAllocation
      : (typeof n.fullAmount === 'number'
        ? n.fullAmount
        : (typeof n.allocation === 'number' ? Math.round(n.allocation / 0.15) : 0))
    return sum + Math.floor(full * pct)
  }, 0)
}

export default function ClaimedPhasesTable({ value, rowData }: { value?: any; rowData?: any }) {
  const phases: PhaseItem[] = Array.isArray(rowData?.claimedPhases) ? rowData.claimedPhases : []
  const claimedNFTs: NFT[] = Array.isArray(rowData?.claimedNFTs) ? rowData.claimedNFTs : []
  const tokenAmount: number = typeof rowData?.tokenAmount === 'number' ? rowData.tokenAmount : 0

  const rows = useMemo(() => {
    return phases.map((p) => {
      const computed = computeTokensForPhase(p.phase, claimedNFTs)
      return {
        phase: p.phase,
        claimedAt: p.claimedAt,
        tokens: typeof p.tokens === 'number' ? p.tokens : computed,
        tx: p.tx,
      }
    })
  }, [phases, claimedNFTs])

  const totalClaimed = rows.reduce((s, r) => s + (typeof r.tokens === 'number' ? r.tokens : 0), 0)
  const remaining = Math.max(0, tokenAmount - totalClaimed)

  if (!rows.length) {
    return <div style={{ padding: '0.5rem 0' }}>No phases claimed yet.</div>
  }

  return (
    <div style={{ padding: '0.5rem 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--theme-elevation-200)', padding: '6px' }}>Phase</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--theme-elevation-200)', padding: '6px' }}>Claimed At</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid var(--theme-elevation-200)', padding: '6px' }}>Tokens</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--theme-elevation-200)', padding: '6px' }}>Tx</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            let href: string | undefined
            if (r.tx) {
              if (r.tx.startsWith('http')) href = r.tx
              else if (isHexTx(r.tx)) href = `https://etherscan.io/tx/${r.tx}`
              else if (isLikelyBase58(r.tx)) href = `https://solscan.io/tx/${r.tx}`
            }
            return (
              <tr key={`${r.phase}-${idx}`}>
                <td style={{ padding: '6px' }}>{r.phase}</td>
                <td style={{ padding: '6px' }}>{fmtDateTime(r.claimedAt)}</td>
                <td style={{ padding: '6px', textAlign: 'right' }}>{(r.tokens ?? 0).toLocaleString()}</td>
                <td style={{ padding: '6px' }}>
                  {r.tx ? (
                    href ? (
                      <a href={href} target="_blank" rel="noreferrer">{r.tx}</a>
                    ) : (
                      <span>{r.tx}</span>
                    )
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            )
          })}
          <tr>
            <td colSpan={4} style={{ paddingTop: '8px' }}>
              <hr style={{ border: 0, borderTop: '1px solid var(--theme-elevation-200)' }} />
            </td>
          </tr>
          <tr>
            <td style={{ padding: '6px', fontWeight: 600 }}>Total Claimed</td>
            <td></td>
            <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>{totalClaimed.toLocaleString()}</td>
            <td></td>
          </tr>
          <tr>
            <td style={{ padding: '6px', fontWeight: 600 }}>Remaining</td>
            <td></td>
            <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>{remaining.toLocaleString()}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

