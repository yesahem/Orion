import { NextRequest, NextResponse } from 'next/server';
import { Aptos, AptosConfig, Network, Ed25519PrivateKey, Account } from '@aptos-labs/ts-sdk';

interface StartRoundRequest {
  durationSecs?: number;
}

interface StartRoundResponse {
  success: boolean;
  roundId?: number;
  transactionHash?: string;
  startPrice?: number;
  expiryTime?: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: StartRoundRequest = await request.json();
    const durationSecs = body.durationSecs || 300; // Default 5 minutes

    // Validate environment variables
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    const moduleAddress = process.env.NEXT_PUBLIC_MODULE_ADDRESS;
    const moduleName = process.env.NEXT_PUBLIC_MODULE_NAME || 'binary_betting';
    const network = process.env.NEXT_PUBLIC_APTOS_NETWORK as Network || Network.TESTNET;

    if (!adminPrivateKey) {
      return NextResponse.json(
        { success: false, error: 'ADMIN_PRIVATE_KEY environment variable is required' },
        { status: 500 }
      );
    }

    if (!moduleAddress) {
      return NextResponse.json(
        { success: false, error: 'NEXT_PUBLIC_MODULE_ADDRESS environment variable is required' },
        { status: 500 }
      );
    }

    // Initialize Aptos client
    const config = new AptosConfig({ network });
    const aptos = new Aptos(config);

    // Create admin account from private key
    const privateKey = new Ed25519PrivateKey(adminPrivateKey);
    const admin = Account.fromPrivateKey({ privateKey });

    // Fetch current price from Pyth
    const priceResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/price`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!priceResponse.ok) {
      throw new Error('Failed to fetch current price');
    }

    const priceData = await priceResponse.json();
    
    // Convert price to 8-decimal format for the contract
    const startPrice = Math.round(priceData.price * 100000000); // Convert to 8 decimals

    // Check if there's already an active round
    try {
      const currentRoundId = await aptos.view({
        payload: {
          function: `${moduleAddress}::${moduleName}::get_current_round_id`,
          functionArguments: [],
        },
      }) as [number];

      if (currentRoundId[0] > 0) {
        // Check if current round is still active
        const roundInfo = await aptos.view({
          payload: {
            function: `${moduleAddress}::${moduleName}::get_round_info`,
            functionArguments: [currentRoundId[0]],
          },
        }) as [number, number, number, boolean, number, number];

        const [, , expiryTime, settled] = roundInfo;
        const currentTime = Math.floor(Date.now() / 1000);

        if (!settled && currentTime < expiryTime) {
          return NextResponse.json({
            success: false,
            error: 'There is already an active round',
            roundId: currentRoundId[0],
            expiryTime,
          });
        }
      }
    } catch (error) {
      // If view call fails, it might mean the contract isn't initialized yet
      console.log('Could not fetch current round info, proceeding with start_round');
    }

    // Submit start_round transaction
    const transaction = await aptos.transaction.build.simple({
      sender: admin.accountAddress,
      data: {
        function: `${moduleAddress}::${moduleName}::start_round`,
        functionArguments: [startPrice, durationSecs],
      },
    });

    const committedTxn = await aptos.signAndSubmitTransaction({
      signer: admin,
      transaction,
    });

    await aptos.waitForTransaction({
      transactionHash: committedTxn.hash,
    });

    // Get the new round ID
    const newRoundId = await aptos.view({
      payload: {
        function: `${moduleAddress}::${moduleName}::get_current_round_id`,
        functionArguments: [],
      },
    }) as [number];

    const expiryTime = Math.floor(Date.now() / 1000) + durationSecs;

    const response: StartRoundResponse = {
      success: true,
      roundId: newRoundId[0],
      transactionHash: committedTxn.hash,
      startPrice: priceData.price,
      expiryTime,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error starting round:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to start round',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET endpoint to check if a new round should be started
export async function GET(request: NextRequest) {
  try {
    const moduleAddress = process.env.NEXT_PUBLIC_MODULE_ADDRESS;
    const moduleName = process.env.NEXT_PUBLIC_MODULE_NAME || 'binary_betting';
    const network = process.env.NEXT_PUBLIC_APTOS_NETWORK as Network || Network.TESTNET;

    if (!moduleAddress) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_MODULE_ADDRESS environment variable is required' },
        { status: 500 }
      );
    }

    const config = new AptosConfig({ network });
    const aptos = new Aptos(config);

    try {
      const currentRoundId = await aptos.view({
        payload: {
          function: `${moduleAddress}::${moduleName}::get_current_round_id`,
          functionArguments: [],
        },
      }) as [number];

      if (currentRoundId[0] === 0) {
        return NextResponse.json({
          shouldStart: true,
          reason: 'No rounds exist yet',
        });
      }

      const roundInfo = await aptos.view({
        payload: {
          function: `${moduleAddress}::${moduleName}::get_round_info`,
          functionArguments: [currentRoundId[0]],
        },
      }) as [number, number, number, boolean, number, number];

      const [, , expiryTime, settled] = roundInfo;
      const currentTime = Math.floor(Date.now() / 1000);

      if (settled || currentTime >= expiryTime) {
        return NextResponse.json({
          shouldStart: true,
          reason: 'Current round is expired or settled',
          currentRoundId: currentRoundId[0],
          expiryTime,
          settled,
        });
      }

      return NextResponse.json({
        shouldStart: false,
        reason: 'Current round is still active',
        currentRoundId: currentRoundId[0],
        expiryTime,
        timeRemaining: expiryTime - currentTime,
      });

    } catch (error) {
      return NextResponse.json({
        shouldStart: true,
        reason: 'Contract not initialized or error checking state',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

  } catch (error) {
    console.error('Error checking round status:', error);
    
    return NextResponse.json({
      error: 'Failed to check round status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
