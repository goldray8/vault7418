import { CollectionConfig } from 'payload/types'

const Claims: CollectionConfig = {
  slug: 'claims',
  hooks: {
    beforeValidate: [({ data }) => {
      if (data) {
        if (typeof data.ethWallet === 'string') data.ethWallet = data.ethWallet.toLowerCase()
        if (typeof data.solWallet === 'string') data.solWallet = data.solWallet.toLowerCase()
      }
      return data
    }],
  },
  admin: {
    useAsTitle: 'ethWallet',
    defaultColumns: [
      // 1–4 basics
      'ethWallet',
      'solWallet',
      'tokenAmount',
      'status',
      // 5–6 NFTs summary in one cell via custom renderer
      'claimedNFTs',
      // New computed column for total NFT allocation
      'totalNFTAllocation',
      // 8–21 booleans + dates; allocation shown within date cells
      'claimedTGE',
      'claimTimestamps.tge',
      'claimedMonth1',
      'claimTimestamps.month1',
      'claimedMonth2',
      'claimTimestamps.month2',
      'claimedMonth3',
      'claimTimestamps.month3',
      'claimedMonth4',
      'claimTimestamps.month4',
    ],
    defaultSort: '-createdAt',
  },
  fields: [
    {
      name: 'ethWallet',
      type: 'text',
      required: true,
    },
    {
      name: 'claimedPhases',
      type: 'array',
      required: false,
      defaultValue: [],
      fields: [
        { name: 'phase', type: 'text' }, // e.g. "TGE", "Month1"
        { name: 'claimedAt', type: 'date' },
        { name: 'tx', type: 'text' }, // optional tx hash
      ],
    },
    {
      name: 'solWallet',
      type: 'text',
      required: true,
    },
    {
      name: 'claimedNFTs',
      type: 'array',
      required: true,
      admin: {
        components: {
          Cell: '@/collections/Claims/components/ClaimedNFTsCell',
        },
      },
      fields: [
        {
          name: 'tokenId',
          type: 'number',
          required: true,
        },
        {
          name: 'rarity',
          type: 'text',
          required: true,
        },
        {
          name: 'allocation',
          type: 'number',
          required: true,
        },
        {
          name: 'fullAllocation',
          type: 'number',
          required: false,
        },
      ],
    },
    // Admin-only computed column for list view; not stored in DB
    {
      name: 'totalNFTAllocation',
      type: 'ui',
      admin: {
        label: 'Total NFT Allocation',
        components: {
          Cell: '@/collections/Claims/components/TotalNFTAllocationCell',
        },
      },
    },
    // Read-only summary table of claimed phases for the edit view
    {
      name: 'claimedPhasesView',
      type: 'ui',
      admin: {
        label: 'Claimed Phases',
        components: {
          Field: '@/collections/Claims/components/ClaimedPhasesTable',
        },
      },
    },
    {
      name: 'tokenAmount',
      type: 'number',
      required: true,
    },

    // ✅ For filtering TGE/Month1/etc.
    {
      name: 'phase',
      type: 'text',
      required: true,
    },

    // ✅ Claim checkboxes
    {
      name: 'claimedTGE',
      type: 'checkbox',
      defaultValue: false,
      admin: { components: { Cell: '@/collections/Claims/components/BooleanTickCell' } },
    },
    {
      name: 'claimedMonth1',
      type: 'checkbox',
      defaultValue: false,
      admin: { components: { Cell: '@/collections/Claims/components/BooleanTickCell' } },
    },
    {
      name: 'claimedMonth2',
      type: 'checkbox',
      defaultValue: false,
      admin: { components: { Cell: '@/collections/Claims/components/BooleanTickCell' } },
    },
    {
      name: 'claimedMonth3',
      type: 'checkbox',
      defaultValue: false,
      admin: { components: { Cell: '@/collections/Claims/components/BooleanTickCell' } },
    },
    {
      name: 'claimedMonth4',
      type: 'checkbox',
      defaultValue: false,
      admin: { components: { Cell: '@/collections/Claims/components/BooleanTickCell' } },
    },

    // ✅ Vesting timeline
    {
      name: 'claimTimestamps',
      type: 'group',
      fields: [
        {
          name: 'tge',
          type: 'date',
          admin: { components: { Cell: '@/collections/Claims/components/DateTGECell' } },
        },
        {
          name: 'month1',
          type: 'date',
          admin: { components: { Cell: '@/collections/Claims/components/DateMonth1Cell' } },
        },
        {
          name: 'month2',
          type: 'date',
          admin: { components: { Cell: '@/collections/Claims/components/DateMonth2Cell' } },
        },
        {
          name: 'month3',
          type: 'date',
          admin: { components: { Cell: '@/collections/Claims/components/DateMonth3Cell' } },
        },
        {
          name: 'month4',
          type: 'date',
          admin: { components: { Cell: '@/collections/Claims/components/DateMonth4Cell' } },
        },
      ],
    },

    // ✅ Fulfillment status
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        {
          label: 'Pending',
          value: 'pending',
        },
        {
          label: 'Sent',
          value: 'sent',
        },
        {
          label: 'Failed',
          value: 'failed',
        },
      ],
    },
  ],
}

export default Claims
