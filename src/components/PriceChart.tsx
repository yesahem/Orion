'use client';

import { useEffect, useRef, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';
import { useBettingStore } from '@/lib/store';
import { usePriceStream } from '@/hooks/usePriceStream';
import { BetMarker } from '@/types';

interface PriceChartProps {
  height?: number;
  className?: string;
}

export default function PriceChart({ height = 400, className = '' }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  const { priceData, betMarkers } = useBettingStore();
  const { isConnected, reconnectAttempts } = usePriceStream();

  // Memoize chart data conversion
  const chartData = useMemo(() => {
    return priceData.map(data => ({
      time: data.time as Time,
      value: data.value,
    })) as LineData[];
  }, [priceData]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#1a1b23' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2a2e39' },
        horzLines: { color: '#2a2e39' },
      },
      crosshair: {
        mode: 1, // Normal crosshair
      },
      rightPriceScale: {
        borderColor: '#485c7b',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: '#485c7b',
        timeVisible: true,
        secondsVisible: true,
      },
    });

    const lineSeries = chart.addLineSeries({
      color: '#4ade80',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 4,
        minMove: 0.0001,
      },
    });

    chartRef.current = chart;
    lineSeriesRef.current = lineSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height]);

  // Update chart data
  useEffect(() => {
    if (lineSeriesRef.current && chartData.length > 0) {
      lineSeriesRef.current.setData(chartData);
    }
  }, [chartData]);

  // Update bet markers
  useEffect(() => {
    if (lineSeriesRef.current && betMarkers.length > 0) {
      const markers = betMarkers.map((marker: BetMarker) => ({
        time: marker.time as Time,
        position: marker.position,
        color: marker.color,
        shape: marker.shape,
        text: marker.text,
        size: marker.size,
      }));
      
      lineSeriesRef.current.setMarkers(markers);
    }
  }, [betMarkers]);

  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1]?.value : 0;
  const priceChange = chartData.length > 1 
    ? chartData[chartData.length - 1]?.value - chartData[chartData.length - 2]?.value 
    : 0;
  const priceChangePercent = chartData.length > 1 
    ? (priceChange / chartData[chartData.length - 2]?.value) * 100 
    : 0;

  return (
    <div className={`bg-gray-900 rounded-lg border border-gray-700 ${className}`}>
      {/* Chart Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-white">APT/USD</h3>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-white">
                ${currentPrice.toFixed(4)}
              </span>
              <span 
                className={`text-sm font-medium px-2 py-1 rounded ${
                  priceChange >= 0 
                    ? 'text-green-400 bg-green-400/10' 
                    : 'text-red-400 bg-red-400/10'
                }`}
              >
                {priceChange >= 0 ? '+' : ''}
                {priceChange.toFixed(4)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-gray-400">
              {isConnected ? 'Live' : reconnectAttempts > 0 ? `Reconnecting... (${reconnectAttempts})` : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        <div ref={chartContainerRef} className="w-full" />
        
        {/* Loading overlay */}
        {!isConnected && reconnectAttempts === 0 && (
          <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Connecting to price feed...</p>
            </div>
          </div>
        )}
        
        {/* Error overlay */}
        {!isConnected && reconnectAttempts >= 5 && (
          <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-red-400 mb-2">Failed to connect to price feed</p>
              <button 
                onClick={() => window.location.reload()}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Refresh page to retry
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chart Legend */}
      <div className="p-3 border-t border-gray-700 text-xs text-gray-400">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-0.5 bg-green-400" />
            <span>Price</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-green-400" />
            <span>UP Bet</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-400" />
            <span>DOWN Bet</span>
          </div>
        </div>
      </div>
    </div>
  );
}
