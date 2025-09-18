/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/nine_lives.json`.
 */
export type NineLives = {
  "address": "82a6CEiJSU8Mz48m5bDr28HfWaefWAQT9KggsJ64i66D",
  "metadata": {
    "name": "nineLives",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Nine Lives SPL token program skeleton (Anchor)"
  },
  "instructions": [
    {
      "name": "addExempt",
      "discriminator": [
        170,
        72,
        81,
        28,
        225,
        107,
        65,
        163
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "addr",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "addLpAccount",
      "discriminator": [
        226,
        135,
        27,
        248,
        157,
        250,
        99,
        211
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "lpTokenAccount",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "burn",
      "discriminator": [
        116,
        110,
        29,
        56,
        107,
        219,
        42,
        93
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "ritualVault",
          "signer": true
        },
        {
          "name": "vaultToken",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "founderWallet",
          "type": "pubkey"
        },
        {
          "name": "marketingWallet",
          "type": "pubkey"
        },
        {
          "name": "ritualVaultWallet",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "lockMintAuthority",
      "discriminator": [
        145,
        150,
        30,
        248,
        111,
        112,
        220,
        159
      ],
      "accounts": [
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "mintAuthority",
          "signer": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "removeExempt",
      "discriminator": [
        245,
        40,
        254,
        205,
        149,
        112,
        101,
        188
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "addr",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "removeLpAccount",
      "discriminator": [
        157,
        3,
        64,
        119,
        252,
        188,
        108,
        187
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "lpTokenAccount",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "transferWithTax",
      "discriminator": [
        151,
        252,
        82,
        111,
        108,
        200,
        32,
        194
      ],
      "accounts": [
        {
          "name": "fromAuthority",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "from",
          "writable": true
        },
        {
          "name": "to",
          "writable": true
        },
        {
          "name": "founderToken",
          "writable": true
        },
        {
          "name": "marketingToken",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6001,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6002,
      "name": "invalidMint",
      "msg": "Invalid mint for token account"
    },
    {
      "code": 6003,
      "name": "taxSplitMismatch",
      "msg": "Tax split mismatch"
    },
    {
      "code": 6004,
      "name": "insufficientNetAmount",
      "msg": "Insufficient amount after tax"
    },
    {
      "code": 6005,
      "name": "mathOverflow",
      "msg": "Math overflow"
    }
  ],
  "types": [
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "founderWallet",
            "type": "pubkey"
          },
          {
            "name": "marketingWallet",
            "type": "pubkey"
          },
          {
            "name": "ritualVaultWallet",
            "type": "pubkey"
          },
          {
            "name": "taxBps",
            "type": "u16"
          },
          {
            "name": "founderBps",
            "type": "u16"
          },
          {
            "name": "marketingBps",
            "type": "u16"
          },
          {
            "name": "exempt",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "lpTokenAccounts",
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    }
  ]
};
