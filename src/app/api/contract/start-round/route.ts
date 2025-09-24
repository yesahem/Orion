import { NextResponse } from 'next/server'
import { Aptos, AptosConfig, Network, Ed25519PrivateKey } from '@aptos-labs/ts-sdk'
import { config } from '@/lib/config'

export async function POST() {
  try {
    if (!config.keeper.privateKey) {
      return NextResponse.json(
        { error: 'Keeper private key not configured' },
        { status: 400 }
      )
    }

    // Get current price from our price API
    const priceResponse = await fetch(`${process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3001'}/api/price`)
    if (!priceResponse.ok) {
      throw new Error('Failed to fetch current price')
    }
    const priceData = await priceResponse.json()
    const currentPrice = priceData.price

    if (!currentPrice || currentPrice <= 0) {
      throw new Error('Invalid price data received')
    }

    // Convert price to micro-dollars (multiply by 1,000,000)
    const startPriceInMicroDollars = Math.floor(currentPrice * 1000000)

    console.log('Starting round with price:', currentPrice, 'micro-dollars:', startPriceInMicroDollars)

    // Initialize Aptos client
    const aptosConfig = new AptosConfig({
      network: config.aptos.network as Network,
    })
    const aptos = new Aptos(aptosConfig)

    // Create keeper account from private key
    const privateKey = new Ed25519PrivateKey(config.keeper.privateKey)
    const keeper = privateKey.toAccount()

    // Start a new round
    const transaction = await aptos.transaction.build.simple({
      sender: keeper.accountAddress,
      data: {
        function: `${config.aptos.moduleAddress}::betting::start_round`,
        functionArguments: [
          config.aptos.moduleAddress, // orion_betting_addr
          startPriceInMicroDollars, // start_price in micro-dollars
          config.keeper.roundDuration, // duration_secs (default: 300 = 5 minutes)
        ],
      },
    })

    const committedTxn = await aptos.signAndSubmitTransaction({
      signer: keeper,
      transaction,
    })

    const executedTxn = await aptos.waitForTransaction({
      transactionHash: committedTxn.hash,
    })

    console.log('Round started:', executedTxn)

    return NextResponse.json({
      success: true,
      message: 'Round started successfully',
      transactionHash: committedTxn.hash,
      startPrice: currentPrice,
      startPriceInMicroDollars,
      duration: config.keeper.roundDuration,
      transaction: executedTxn,
    })
  } catch (error: any) {
    console.error('Error starting round:', error)
    return NextResponse.json(
      { 
        error: 'Failed to start round',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    )
  }
}
