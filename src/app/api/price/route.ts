import { NextResponse } from 'next/server'
import { config } from '@/lib/config'

export async function GET() {
  try {
    const response = await fetch(
      `${config.pyth.endpoint}/v2/updates/price/latest?ids[]=${config.pyth.aptUsdPriceId}&parsed=true`,
      {
        next: { revalidate: 1 }, // Cache for 1 second
      }
    )

    if (!response.ok) {
      throw new Error(`Pyth API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.parsed || data.parsed.length === 0) {
      throw new Error('No price data received from Pyth')
    }

    const priceData = data.parsed[0].price
    const price = parseFloat(priceData.price) * Math.pow(10, priceData.expo)
    const confidence = parseFloat(priceData.conf) * Math.pow(10, priceData.expo)
    const timestamp = parseInt(priceData.publish_time)

    return NextResponse.json({
      price,
      confidence,
      timestamp,
      symbol: 'APT/USD',
    })
  } catch (error) {
    console.error('Error fetching price:', error)
    return NextResponse.json(
      { error: 'Failed to fetch price data' },
      { status: 500 }
    )
  }
}
