import * as bitcoin from 'bitcoinjs-lib'
import * as bip39 from 'bip39'
import * as ecc from 'tiny-secp256k1'
import { BIP32Factory } from 'bip32'

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

bitcoin.initEccLib(ecc)
const bip32 = BIP32Factory(ecc)

export interface TaprootWallet {
  address: string
  path: string
  payment: bitcoin.Payment
  internalPubkey: Buffer
  tweakedChildNode: bitcoin.Signer
}

export const signetNetwork = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: { public: 0x045f1cf6, private: 0x045f18bc },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef
}

export const getTaprootWallet = (pathNumber: number): TaprootWallet => {
  const seed = bip39.mnemonicToSeedSync(MNEMONIC)
  const rootKey = bip32.fromSeed(seed, signetNetwork)

  const path = `m/86'/0'/0'/0/${pathNumber}`
  const childNode = rootKey.derivePath(path)
  const internalPubkey = childNode.publicKey.subarray(1, 33)

  const payment = bitcoin.payments.p2tr({
    internalPubkey,
    network: signetNetwork
  })

  const tweakedChildNode = childNode.tweak(bitcoin.crypto.taggedHash('TapTweak', internalPubkey))

  if (!payment.address) throw new Error('Failed to generate address')

  return {
    address: payment.address,
    path,
    payment,
    internalPubkey,
    tweakedChildNode
  }
}
