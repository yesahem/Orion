import { NextResponse } from 'next/server'
import { Aptos, AptosConfig, Network, Ed25519PrivateKey, Account } from '@aptos-labs/ts-sdk'
import { config } from '@/lib/config'

export async function POST() {
  try {
    if (!config.keeper.privateKey) {
      return NextResponse.json(
        { error: 'Keeper private key not configured' },
        { status: 400 }
      )
    }

    // Initialize Aptos client
    const aptosConfig = new AptosConfig({
      network: config.aptos.network as Network,
      fullnode: config.aptos.nodeUrl,
      clientConfig: {
        HEADERS: {
          Authorization: `Bearer ${config.aptos.apiKey}`,
          Origin: 'http://localhost:3001',
          'Content-Type': 'application/json',
        }
      },
    })
    const aptos = new Aptos(aptosConfig)

    // Create keeper account from private key
    const privateKey = new Ed25519PrivateKey(config.keeper.privateKey)
    const keeper = Account.fromPrivateKey({ privateKey })

    console.log('Initializing contract with keeper:', keeper.accountAddress.toString())

    // Check if contract is already initialized
    try {
      const resource = await aptos.getAccountResource({
        accountAddress: config.aptos.moduleAddress,
        resourceType: `${config.aptos.moduleAddress}::betting::State`,
      })
      
      if (resource) {
        return NextResponse.json({
          success: true,
          message: 'Contract already initialized',
          state: resource,
        })
      }
    } catch (error) {
      // Contract not initialized yet, proceed with initialization
      console.log('Contract not yet initialized, proceeding...')
    }

    // Initialize the contract
    const transaction = await aptos.transaction.build.simple({
      sender: keeper.accountAddress,
      data: {
        function: `${config.aptos.moduleAddress}::betting::init`,
        functionArguments: [
          keeper.accountAddress.toString(), // admin
          200, // fee_bps (2%)
          keeper.accountAddress.toString(), // treasury (same as admin for now)
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

    console.log('Contract initialized:', executedTxn)

    return NextResponse.json({
      success: true,
      message: 'Contract initialized successfully',
      transactionHash: committedTxn.hash,
      transaction: executedTxn,
    })
  } catch (error: any) {
    console.error('Error initializing contract:', error)
    return NextResponse.json(
      { 
        error: 'Failed to initialize contract',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    )
  }
}
