import { NextRequest, NextResponse } from 'next/server';

interface PythPriceData {
  id: string;
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
  ema_price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
}

interface PriceResponse {
  price: number;
  confidence: number;
  publishTime: number;
  priceId: string;
}

export async function GET(request: NextRequest) {
  try {
    const pythEndpoint = process.env.NEXT_PUBLIC_PYTH_ENDPOINT || 'https://hermes.pyth.network';
    const priceId = process.env.NEXT_PUBLIC_PYTH_APT_USD_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_PYTH_APT_USD_PRICE_ID environment variable is required' },
        { status: 500 }
      );
    }

    // Fetch latest price data from Pyth Hermes
    const url = `${pythEndpoint}/v2/updates/price/latest?ids[]=${priceId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add cache control to ensure fresh data
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Pyth API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.parsed || !data.parsed[0]) {
      throw new Error('No price data returned from Pyth');
    }

    const priceData: PythPriceData = data.parsed[0];
    
    // Convert price from Pyth format to standard format
    // Pyth prices come with an exponent, so we need to calculate: price * 10^expo
    const rawPrice = parseInt(priceData.price.price);
    const expo = priceData.price.expo;
    const confidence = parseInt(priceData.price.conf);
    
    // Calculate the actual price
    const actualPrice = rawPrice * Math.pow(10, expo);
    const actualConfidence = confidence * Math.pow(10, expo);

    const result: PriceResponse = {
      price: actualPrice,
      confidence: actualConfidence,
      publishTime: priceData.price.publish_time,
      priceId: priceData.id,
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching price data:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch price data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { timestamp } = body;

    if (!timestamp) {
      return NextResponse.json(
        { error: 'Timestamp is required' },
        { status: 400 }
      );
    }

    const pythEndpoint = process.env.NEXT_PUBLIC_PYTH_ENDPOINT || 'https://hermes.pyth.network';
    const priceId = process.env.NEXT_PUBLIC_PYTH_APT_USD_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_PYTH_APT_USD_PRICE_ID environment variable is required' },
        { status: 500 }
      );
    }

    // Fetch historical price data for a specific timestamp
    const url = `${pythEndpoint}/v2/updates/price/${timestamp}?ids[]=${priceId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Pyth API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.parsed || !data.parsed[0]) {
      throw new Error('No price data returned from Pyth for the specified timestamp');
    }

    const priceData: PythPriceData = data.parsed[0];
    
    const rawPrice = parseInt(priceData.price.price);
    const expo = priceData.price.expo;
    const confidence = parseInt(priceData.price.conf);
    
    const actualPrice = rawPrice * Math.pow(10, expo);
    const actualConfidence = confidence * Math.pow(10, expo);

    const result: PriceResponse = {
      price: actualPrice,
      confidence: actualConfidence,
      publishTime: priceData.price.publish_time,
      priceId: priceData.id,
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching historical price data:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch historical price data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
