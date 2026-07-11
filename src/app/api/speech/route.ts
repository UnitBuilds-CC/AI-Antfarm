import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const headers = request.headers;

    const apiKey = headers.get('x-elevenlabs-api-key') || process.env.ELEVENLABS_API_KEY;
    const voiceId = headers.get('x-elevenlabs-voice-id') || 'onwK4e9Gkvt875cghbq6'; // Deep narrator voice ("Sirius" or default)
    const { text } = body;

    if (!apiKey) {
      // No key, return json indicator so client uses browser Web Speech synthesis
      return NextResponse.json({ mock: true, message: 'No ElevenLabs API key configured. Using local browser speech.' });
    }

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const response = await fetch(elevenLabsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[ELEVENLABS ERROR] HTTP status ${response.status}: ${errText}`);
      return NextResponse.json({ mock: true, error: `ElevenLabs failed: ${response.statusText}` });
    }

    // Get the audio array buffer
    const audioBuffer = await response.arrayBuffer();

    // Return the audio stream
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      }
    });
  } catch (error: any) {
    console.error('[API Speech Error]:', error);
    return NextResponse.json({ mock: true, error: error.message }, { status: 500 });
  }
}
