'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useBettingStore } from '@/lib/store';
import { config } from '@/lib/config';
import { ChartData } from '@/types';

interface PythStreamData {
  type: string;
  price_feed: {
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
  };
}

export function usePriceStream() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second
  
  const { addPriceData, setError } = useBettingStore();

  const connect = useCallback(() => {
    try {
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Create WebSocket connection to Pyth Hermes
      const wsUrl = `wss://hermes.pyth.network/ws`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Connected to Pyth WebSocket');
        reconnectAttemptsRef.current = 0;
        setError(null);
        
        // Subscribe to APT/USD price feed
        const subscribeMessage = {
          ids: [config.pythPriceId],
          type: 'subscribe',
        };
        
        wsRef.current?.send(JSON.stringify(subscribeMessage));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data: PythStreamData = JSON.parse(event.data);
          
          if (data.type === 'price_update' && data.price_feed) {
            const priceFeed = data.price_feed;
            
            if (priceFeed.id === config.pythPriceId) {
              const rawPrice = parseInt(priceFeed.price.price);
              const expo = priceFeed.price.expo;
              const publishTime = priceFeed.price.publish_time;
              
              // Calculate actual price
              const actualPrice = rawPrice * Math.pow(10, expo);
              
              const chartData: ChartData = {
                time: publishTime,
                value: actualPrice,
              };
              
              addPriceData(chartData);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('Pyth WebSocket connection closed:', event.code, event.reason);
        
        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;
          
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError('Failed to connect to price feed after multiple attempts');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Pyth WebSocket error:', error);
        setError('Price feed connection error');
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setError('Failed to connect to price feed');
    }
  }, [addPriceData, setError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    reconnectAttemptsRef.current = 0;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    reconnectAttempts: reconnectAttemptsRef.current,
    connect,
    disconnect,
  };
}
