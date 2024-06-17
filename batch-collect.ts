import * as bitcoin from 'bitcoinjs-lib'
import axios from 'axios'
import { signetNetwork, getTaprootWallet, TaprootWallet } from './wallet'

const targetAddress: string = 'your-receive-address'

interface UTXO {
  txid: string
  vout: number
  value: number
}

const taprootInputSize: number = 106
const taprootOutputSize: number = 42
const overhead: number = 10

async function getUtxos(address: string): Promise<UTXO[]> {
  const response = await axios.get(`https://mempool.space/signet/api/address/${address}/utxo`)
  const utxos: UTXO[] = response.data.map((utxo: any) => ({
    txid: utxo.txid,
    vout: utxo.vout,
    value: utxo.value
  }))
  return utxos
}

const getTotalBalance = async (address: string): Promise<number> => {
  const response = await axios.get(`https://mempool.space/signet/api/address/${address}`)
  const { funded_txo_sum, spent_txo_sum } = response.data.chain_stats

  return funded_txo_sum - spent_txo_sum
}

async function createAndSendTransaction(utxos: UTXO[], wallet: TaprootWallet, targetAddress: string): Promise<string> {
  const psbt = new bitcoin.Psbt({ network: signetNetwork })

  let totalInput: number = 0

  for (let utxo of utxos) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: wallet.payment.output!,
        value: utxo.value
      },
      tapInternalKey: wallet.internalPubkey
    })

    totalInput += utxo.value
  }

  const feeRate: number = 1
  const txBytes: number = psbt.txInputs.length * taprootInputSize + psbt.txOutputs.length * taprootOutputSize + overhead
  const fee: number = txBytes * feeRate
  const amountToSend: number = totalInput - fee

  console.log(`total input is ${totalInput}, fee is ${fee}, amountToSend is ${amountToSend}`)

  psbt.addOutput({
    address: targetAddress,
    value: amountToSend
  })

  psbt.signAllInputs(wallet.tweakedChildNode)
  psbt.finalizeAllInputs()

  const tx: bitcoin.Transaction = psbt.extractTransaction()
  const rawTx: string = tx.toHex()

  const response = await axios.post('https://mempool.space/signet/api/tx', rawTx)
  return response.data
}

const batchCollectBTC = async (pathNumber: number, targetAddress: string): Promise<void> => {
  const wallet = getTaprootWallet(pathNumber)

  const utxos = await getUtxos(wallet.address)

  const totalBalance = await getTotalBalance(wallet.address)

  if (totalBalance > 0) {
    const txid: string = await createAndSendTransaction(utxos, wallet, targetAddress)

    console.log(`sent ${totalBalance} satoshi from ${wallet.address} to ${targetAddress}. tx ID: ${txid}`)
  } else {
    console.log(`no.${pathNumber}: ${wallet.address} has not UTXOs.`)
  }
}

let num = 0
let count = 10

const main = async () => {
  while (num < count) {
    await batchCollectBTC(num, targetAddress).catch(console.error)

    num += 1
  }
}

main()
