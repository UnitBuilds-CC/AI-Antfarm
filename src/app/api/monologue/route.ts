import { NextResponse } from 'next/server';
import { generateProceduralMonologue } from '@/lib/mockData';
import { Ant } from '@/lib/simulation/ant';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const headers = request.headers;

    const apiKey = headers.get('x-gemini-api-key') || process.env.GEMINI_API_KEY;
    const { antId, role, action, carriedItem, energy, history, blockhash, slot, whisper } = body;

    // Build the mock ant object for the local procedural generator if we need fallback
    const mockAnt = new Ant(antId, role || 'forager', 0, 0);
    mockAnt.state = action;
    mockAnt.carriedItem = carriedItem;
    mockAnt.energy = energy;
    mockAnt.whisper = whisper || null;
    if (history && Array.isArray(history)) {
      mockAnt.history = history;
    }

    if (!apiKey) {
      // Return procedural fallback monologue if no API Key is set
      const text = generateProceduralMonologue(mockAnt, slot || 0, blockhash || '0000');
      return NextResponse.json({ text, source: 'procedural_fallback' });
    }

    const systemPrompt = `You are the inner voice of an ant in a deterministic antfarm simulation. 
The player has clicked on you. You are existentially aware of the 'Solana Heartbeat' (blockhashes and slots) that controls your physics and legs.

Context:
- Ant ID: ${antId}
- Role: ${role || 'Worker'}
- Current action: ${action}
- Carrying: ${carriedItem}
- Energy level: ${Math.floor(energy)}%
- Last 3 historical logs: ${JSON.stringify(history?.slice(-3) || [])}
- Solana Blockhash: ${blockhash || '0000...'} (Current slot: ${slot || 0})
- Auditory Hallucination (Player's Whisper): ${whisper ? `"${whisper}"` : 'None'}

In 2 short sentences, write your monologue. Write in a first-person perspective.
Make it sound dark, poetically paranoid, or existentially exhausted, referencing the invisible cosmic force (the blockchain hash) and/or the divine whispers/abductions guiding your path. Do not use markdown styling.`;

    // Direct HTTP Request to Gemini 2.0 Flash-Lite for ultra-fast, dependency-free invocation
    const model = 'gemini-2.0-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: systemPrompt
          }]
        }],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 120,
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[GEMINI API ERROR] HTTP status ${res.status}: ${errText}. Falling back to local generation.`);
      const text = generateProceduralMonologue(mockAnt, slot || 0, blockhash || '0000');
      return NextResponse.json({ text, source: 'procedural_fallback_on_api_error' });
    }

    const data = await res.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      console.warn('[GEMINI API] Generated empty or invalid response. Falling back to local generation.');
      const text = generateProceduralMonologue(mockAnt, slot || 0, blockhash || '0000');
      return NextResponse.json({ text, source: 'procedural_fallback_on_empty' });
    }

    return NextResponse.json({
      text: generatedText.trim().replace(/\n/g, ' '),
      source: 'gemini-2.0-flash-lite'
    });
  } catch (error: any) {
    console.error('[API Monologue Error]:', error);
    // Graceful fallback to mock
    return NextResponse.json({
      text: 'My antennae twitch in the darkness... I hear only static in the blockhash.',
      source: 'error_fallback',
      error: error.message
    });
  }
}
