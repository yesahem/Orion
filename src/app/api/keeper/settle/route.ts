import { NextRequest, NextResponse } from 'next/server';
import { Aptos, AptosConfig, Network, Ed25519PrivateKey, Account } from '@aptos-labs/ts-sdk';

interface SettleRoundRequest {
  roundId: number;
  endPrice?: number; // Optional - if not provided, will fetch from Pyth
}

interface SettleRoundResponse {
  success: boolean;
  roundId: number;
  transactionHash?: string;
  startPrice?: number;
  endPrice?: number;
  upWins?: boolean;
  isTie?: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SettleRoundRequest = await request.json();
    const { roundId, endPrice: providedEndPrice } = body;

    if (!roundId) {
      return NextResponse.json(
        { success: false, error: 'Round ID is required' },
        { status: 400 }
      );
    }

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

    // Get round information first
    const roundInfo = await aptos.view({
      payload: {
        function: `${moduleAddress}::${moduleName}::get_round_info`,
        functionArguments: [roundId],
      },
    }) as [number, number, number, boolean, number, number];

    const [startPrice, currentEndPrice, expiryTime, settled, upPool, downPool] = roundInfo;

    if (settled) {
      return NextResponse.json({
        success: false,
        error: 'Round is already settled',
        roundId,
      });
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime < expiryTime) {
      return NextResponse.json({
        success: false,
        error: 'Round has not expired yet',
        roundId,
        expiryTime,
        timeRemaining: expiryTime - currentTime,
      });
    }

    // Get end price - either provided or fetch from Pyth
    let endPrice: number;
    
    if (providedEndPrice !== undefined) {
      endPrice = providedEndPrice;
    } else {
      // Fetch price at expiry time from Pyth
      const priceResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timestamp: expiryTime }),
      });

      if (!priceResponse.ok) {
        // If historical price fetch fails, use current price as fallback
        console.warn('Failed to fetch historical price, using current price');
        const currentPriceResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/price`, {
          method: 'GET',
        });

        if (!currentPriceResponse.ok) {
          throw new Error('Failed to fetch price data');
        }

        const currentPriceData = await currentPriceResponse.json();
        endPrice = currentPriceData.price;
      } else {
        const priceData = await priceResponse.json();
        endPrice = priceData.price;
      }
    }

    // Convert price to 8-decimal format for the contract
    const endPriceForContract = Math.round(endPrice * 100000000); // Convert to 8 decimals

    // Submit settle transaction
    const transaction = await aptos.transaction.build.simple({
      sender: admin.accountAddress,
      data: {
        function: `${moduleAddress}::${moduleName}::settle`,
        functionArguments: [roundId, endPriceForContract],
      },
    });

    const committedTxn = await aptos.signAndSubmitTransaction({
      signer: admin,
      transaction,
    });

    await aptos.waitForTransaction({
      transactionHash: committedTxn.hash,
    });

    // Determine outcome
    const startPriceActual = startPrice / 100000000; // Convert from 8 decimals
    const isTie = Math.abs(startPriceActual - endPrice) < 0.0001; // Small tolerance for floating point
    const upWins = endPrice > startPriceActual;

    const response: SettleRoundResponse = {
      success: true,
      roundId,
      transactionHash: committedTxn.hash,
      startPrice: startPriceActual,
      endPrice,
      upWins,
      isTie,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error settling round:', error);
    
    return NextResponse.json({
      success: false,
      roundId: body?.roundId || 0,
      error: 'Failed to settle round',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET endpoint to check which rounds need settling
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

    const roundsNeedingSettlement = [];

    try {
      const currentRoundId = await aptos.view({
        payload: {
          function: `${moduleAddress}::${moduleName}::get_current_round_id`,
          functionArguments: [],
        },
      }) as [number];

      if (currentRoundId[0] === 0) {
        return NextResponse.json({
          roundsNeedingSettlement: [],
          message: 'No rounds exist yet',
        });
      }

      const currentTime = Math.floor(Date.now() / 1000);

      // Check the current round and a few previous ones
      for (let roundId = Math.max(1, currentRoundId[0] - 5); roundId <= currentRoundId[0]; roundId++) {
        try {
          const roundInfo = await aptos.view({
            payload: {
              function: `${moduleAddress}::${moduleName}::get_round_info`,
              functionArguments: [roundId],
            },
          }) as [number, number, number, boolean, number, number];

          const [startPrice, endPrice, expiryTime, settled, upPool, downPool] = roundInfo;

          if (!settled && currentTime >= expiryTime) {
            roundsNeedingSettlement.push({
              roundId,
              startPrice: startPrice / 100000000,
              expiryTime,
              upPool,
              downPool,
              expiredBy: currentTime - expiryTime,
            });
          }
        } catch (error) {
          // Round might not exist, skip
          continue;
        }
      }

      return NextResponse.json({
        roundsNeedingSettlement,
        currentTime,
      });

    } catch (error) {
      return NextResponse.json({
        roundsNeedingSettlement: [],
        error: 'Contract not initialized or error checking state',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

  } catch (error) {
    console.error('Error checking rounds for settlement:', error);
    
    return NextResponse.json({
      error: 'Failed to check rounds for settlement',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
