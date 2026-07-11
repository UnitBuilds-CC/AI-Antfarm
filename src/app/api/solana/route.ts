import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { generateMockHash } from '@/lib/mockData';

// Cache the last fetched blockhash to prevent RPC rate limits
let cachedHash = '';
let cachedSlot = 0;
let lastFetchTime = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rpcUrl = searchParams.get('rpcUrl') || process.env.SOLANA_RPC_URL;
  const isMock = searchParams.get('mock') === 'true';

  // 1. Return mock data if requested or if no key/RPC is available
  if (isMock || (!rpcUrl && !process.env.SOLANA_RPC_URL)) {
    // Generate ticking mock slots
    const now = Date.now();
    const timeDelta = now - (lastFetchTime || now);
    // Standard Solana slot is ~400ms. Increment mock slot based on time elapsed
    const slotIncrement = lastFetchTime === 0 ? 0 : Math.max(1, Math.floor(timeDelta / 400));
    
    if (cachedSlot === 0) {
      cachedSlot = 192837465;
      cachedHash = generateMockHash();
    } else if (slotIncrement > 0) {
      cachedSlot += slotIncrement;
      cachedHash = generateMockHash();
    }
    
    lastFetchTime = now;
    
    return NextResponse.json({
      hash: cachedHash,
      slot: cachedSlot,
      source: 'mock'
    });
  }

  // 2. Fetch from Solana RPC
  try {
    const targetRpc = rpcUrl || 'https://api.devnet.solana.com';
    const connection = new Connection(targetRpc, 'confirmed');
    
    // Throttle RPC queries to max once per 1 second to avoid rate-limiting
    const now = Date.now();
    if (now - lastFetchTime > 1000 || cachedHash === '') {
      const [{ blockhash }, slot] = await Promise.all([
        connection.getLatestBlockhash(),
        connection.getSlot()
      ]);
      
      cachedHash = blockhash;
      cachedSlot = slot;
      lastFetchTime = now;
    }

    return NextResponse.json({
      hash: cachedHash,
      slot: cachedSlot,
      source: 'rpc'
    });
  } catch (error: any) {
    console.error('Solana RPC Fetch Error:', error);
    // Graceful fallback to mock on error
    if (cachedSlot === 0) {
      cachedSlot = 192837465;
    } else {
      cachedSlot += 1;
    }
    cachedHash = generateMockHash();
    lastFetchTime = Date.now();

    return NextResponse.json({
      hash: cachedHash,
      slot: cachedSlot,
      source: 'mock_fallback',
      error: error.message
    });
  }
}
