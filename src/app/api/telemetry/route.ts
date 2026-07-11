import { NextResponse } from 'next/server';
import { SnowflakeConnector } from '@/lib/snowflake';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const headers = request.headers;

    // Retrieve Snowflake credentials from headers if supplied dynamically by client,
    // otherwise fallback to system env variables
    const account = headers.get('x-snowflake-account') || undefined;
    const username = headers.get('x-snowflake-username') || undefined;
    const password = headers.get('x-snowflake-password') || undefined;
    const database = headers.get('x-snowflake-database') || undefined;
    const schema = headers.get('x-snowflake-schema') || undefined;
    const warehouse = headers.get('x-snowflake-warehouse') || undefined;

    const connector = new SnowflakeConnector({
      account,
      username,
      password,
      database,
      schema,
      warehouse
    });

    const { type, telemetry, lifecycle, lore } = body;

    if (type === 'telemetry' && Array.isArray(telemetry)) {
      await connector.logTelemetryBatch(telemetry);
    } else if (type === 'lifecycle' && lifecycle) {
      await connector.logLifecycle(lifecycle);
    } else if (type === 'lore' && lore) {
      await connector.logLore(lore);
    } else if (type === 'init') {
      await connector.initializeTables();
    } else {
      return NextResponse.json({ success: false, error: 'Invalid payload type or content' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API Telemetry Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
