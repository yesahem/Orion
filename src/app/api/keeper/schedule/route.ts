import { NextRequest, NextResponse } from 'next/server';

interface ScheduleStatus {
  nextRoundStart?: number;
  roundsToSettle?: Array<{
    roundId: number;
    expiredBy: number;
  }>;
  lastCheck: number;
}

let lastScheduleCheck = 0;
const SCHEDULE_INTERVAL = 60000; // 1 minute

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    
    // Prevent too frequent checks
    if (now - lastScheduleCheck < SCHEDULE_INTERVAL) {
      return NextResponse.json({
        message: 'Schedule check too frequent',
        nextCheckIn: SCHEDULE_INTERVAL - (now - lastScheduleCheck),
      });
    }
    
    lastScheduleCheck = now;
    
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    // Check if we need to start a new round
    const startCheckResponse = await fetch(`${baseUrl}/api/keeper/start`, {
      method: 'GET',
    });
    
    const startCheckData = await startCheckResponse.json();
    
    // Check if we need to settle any rounds
    const settleCheckResponse = await fetch(`${baseUrl}/api/keeper/settle`, {
      method: 'GET',
    });
    
    const settleCheckData = await settleCheckResponse.json();
    
    const status: ScheduleStatus = {
      lastCheck: now,
    };
    
    // Auto-start round if needed
    if (startCheckData.shouldStart) {
      try {
        const startResponse = await fetch(`${baseUrl}/api/keeper/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        
        const startResult = await startResponse.json();
        
        if (startResult.success) {
          status.nextRoundStart = startResult.expiryTime;
        }
      } catch (error) {
        console.error('Error auto-starting round:', error);
      }
    }
    
    // Auto-settle rounds if needed
    if (settleCheckData.roundsNeedingSettlement?.length > 0) {
      const settlementPromises = settleCheckData.roundsNeedingSettlement.map(
        async (round: any) => {
          try {
            const settleResponse = await fetch(`${baseUrl}/api/keeper/settle`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ roundId: round.roundId }),
            });
            
            return await settleResponse.json();
          } catch (error) {
            console.error(`Error settling round ${round.roundId}:`, error);
            return null;
          }
        }
      );
      
      await Promise.all(settlementPromises);
      status.roundsToSettle = settleCheckData.roundsNeedingSettlement;
    }
    
    return NextResponse.json({
      success: true,
      status,
      startCheck: startCheckData,
      settleCheck: settleCheckData,
    });
    
  } catch (error) {
    console.error('Error in keeper schedule:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Keeper schedule failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Development-only auto-scheduler
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Auto-scheduler only available in development' },
      { status: 403 }
    );
  }
  
  const { action } = await request.json();
  
  if (action === 'start_auto_scheduler') {
    // In a real app, you'd use a proper job queue like Bull or a cron service
    // This is just for development testing
    const scheduleInterval = setInterval(async () => {
      try {
        await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/keeper/schedule`, {
          method: 'GET',
        });
      } catch (error) {
        console.error('Auto-scheduler error:', error);
      }
    }, 60000); // Every minute
    
    // Store interval ID (in a real app, you'd persist this properly)
    (global as any).keeperScheduleInterval = scheduleInterval;
    
    return NextResponse.json({
      success: true,
      message: 'Auto-scheduler started (development mode)',
    });
  }
  
  if (action === 'stop_auto_scheduler') {
    const intervalId = (global as any).keeperScheduleInterval;
    if (intervalId) {
      clearInterval(intervalId);
      (global as any).keeperScheduleInterval = null;
    }
    
    return NextResponse.json({
      success: true,
      message: 'Auto-scheduler stopped',
    });
  }
  
  return NextResponse.json(
    { error: 'Invalid action' },
    { status: 400 }
  );
}
