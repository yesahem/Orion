'use client'

import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts'
import { useBettingStore } from '@/store/betting'
import { config } from '@/lib/config'

interface BetMarker {
  time: number
  side: 'up' | 'down'
  price: number
}

export function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  
  const { priceHistory, addPricePoint, currentPrice } = useBettingStore()
  const [betMarkers, setBetMarkers] = useState<BetMarker[]>([])

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: 'rgba(17, 24, 39, 1)' },
        textColor: '#ffffff',
      },
      grid: {
        vertLines: { color: 'rgba(75, 85, 99, 0.3)' },
        horzLines: { color: 'rgba(75, 85, 99, 0.3)' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'rgba(75, 85, 99, 0.5)',
      },
      timeScale: {
        borderColor: 'rgba(75, 85, 99, 0.5)',
        timeVisible: true,
        secondsVisible: true,
      },
    })

    const lineSeries = chart.addLineSeries({
      color: '#3B82F6',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 4,
        minMove: 0.0001,
      },
    })

    chartRef.current = chart
    lineSeriesRef.current = lineSeries

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    })

    resizeObserver.observe(chartContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
    }
  }, [])

  // Update chart with price history
  useEffect(() => {
    if (lineSeriesRef.current && priceHistory.length > 0) {
      const data: LineData[] = priceHistory.map(point => ({
        time: Math.floor(point.time / 1000) as Time,
        value: point.value,
      }))
      
      lineSeriesRef.current.setData(data)
    }
  }, [priceHistory])

  // WebSocket connection for live price updates
  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = `wss://hermes.pyth.network/ws`
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('Connected to Pyth WebSocket')
        // Subscribe to APT/USD price updates
        ws.send(JSON.stringify({
          ids: [config.pyth.aptUsdPriceId],
          type: 'subscribe',
          verbose: true,
        }))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'price_update') {
            const priceData = data.price_feed?.price
            if (priceData) {
              const price = parseFloat(priceData.price) * Math.pow(10, priceData.expo)
              addPricePoint(price)
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.onclose = () => {
        console.log('WebSocket connection closed, reconnecting...')
        setTimeout(connectWebSocket, 3000)
      }

      wsRef.current = ws
    }

    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [addPricePoint])

  // Add bet markers to chart
  useEffect(() => {
    if (chartRef.current && betMarkers.length > 0) {
      const markers = betMarkers.map(marker => ({
        time: Math.floor(marker.time / 1000) as Time,
        position: 'inBar' as const,
        color: marker.side === 'up' ? '#10B981' : '#EF4444',
        shape: marker.side === 'up' ? 'arrowUp' as const : 'arrowDown' as const,
        text: `${marker.side.toUpperCase()} @ $${marker.price.toFixed(4)}`,
      }))

      lineSeriesRef.current?.setMarkers(markers)
    }
  }, [betMarkers])

  // Function to add bet marker (called from parent component)
  const addBetMarker = (side: 'up' | 'down', price: number) => {
    const newMarker: BetMarker = {
      time: Date.now(),
      side,
      price,
    }
    setBetMarkers(prev => [...prev.slice(-20), newMarker]) // Keep last 20 markers
  }

  // Expose addBetMarker to parent components
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as { addBetMarker?: (side: 'up' | 'down', price: number) => void }).addBetMarker = addBetMarker
    }
  }, [])

  return (
    <div className="w-full bg-gray-900 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">APT/USD</h3>
            <p className="text-sm text-gray-400">Live Price Chart</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono text-white">
              ${currentPrice.toFixed(4)}
            </div>
            <div className="text-sm text-gray-400">Current Price</div>
          </div>
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full h-[400px]" />
      
      {/* Legend */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>UP Bets</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>DOWN Bets</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-blue-500"></div>
            <span>Price Line</span>
          </div>
        </div>
      </div>
    </div>
  )
}
