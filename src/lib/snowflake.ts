import snowflake from 'snowflake-sdk';

export interface TelemetryRecord {
  eventId: string;
  antId: string;
  slot: number;
  blockhash: string;
  x: number;
  y: number;
  action: string;
  energy: number;
  carriedItem: string;
  timestamp: string;
}

export interface LifecycleRecord {
  antId: string;
  generation: number;
  birthSlot: number;
  deathSlot: number | null;
  deathReason: string | null;
}

export interface LoreRecord {
  loreId: string;
  slot: number;
  eventType: string;
  description: string;
  seededHash: string;
}

// In-memory mock database for development without Snowflake
class LocalMockDatabase {
  public telemetry: TelemetryRecord[] = [];
  public lifecycle: LifecycleRecord[] = [];
  public lore: LoreRecord[] = [];

  constructor() {
    console.log('[MOCK DB] Local in-memory telemetry system initialized.');
  }

  public insertTelemetryBatch(records: TelemetryRecord[]) {
    this.telemetry.push(...records);
    if (this.telemetry.length > 1000) {
      this.telemetry = this.telemetry.slice(-1000); // cap size
    }
    console.log(`[MOCK DB] Batched ${records.length} telemetry steps. Total records: ${this.telemetry.length}`);
  }

  public insertLifecycle(record: LifecycleRecord) {
    const existing = this.lifecycle.find(l => l.antId === record.antId);
    if (existing) {
      existing.deathSlot = record.deathSlot;
      existing.deathReason = record.deathReason;
    } else {
      this.lifecycle.push(record);
    }
    console.log(`[MOCK DB] Lifecycle log for ${record.antId}: BirthSlot=${record.birthSlot}, DeathSlot=${record.deathSlot || 'ALIVE'}`);
  }

  public insertLore(record: LoreRecord) {
    this.lore.unshift(record);
    console.log(`[MOCK DB] Historical Lore recorded: [${record.eventType}] ${record.description}`);
  }

  public getAntHistory(antId: string, limit: number = 3): string[] {
    const events = this.telemetry
      .filter(t => t.antId === antId)
      .slice(-limit)
      .map(t => `${t.action} at coord (${Math.floor(t.x)},${Math.floor(t.y)}) carrying ${t.carriedItem}`);

    const lifecycle = this.lifecycle.find(l => l.antId === antId);
    if (lifecycle) {
      events.unshift(`Born at Slot ${lifecycle.birthSlot}`);
    }
    return events;
  }
}

export const localMockDb = new LocalMockDatabase();

// Maintain a global connection reference across serverless cold starts
const globalForSnowflake = global as unknown as {
  snowflakeConnection: any;
};

if (!globalForSnowflake.snowflakeConnection) {
  globalForSnowflake.snowflakeConnection = null;
}

// Snowflake Connection Pool & Operations
export class SnowflakeConnector {
  private config: any;
  private isConfigured: boolean = false;

  constructor(customConfig?: any) {
    const account = customConfig?.account || process.env.SNOWFLAKE_ACCOUNT;
    const username = customConfig?.username || process.env.SNOWFLAKE_USERNAME;
    const password = customConfig?.password || process.env.SNOWFLAKE_PASSWORD;
    const database = customConfig?.database || process.env.SNOWFLAKE_DATABASE;
    const schema = customConfig?.schema || process.env.SNOWFLAKE_SCHEMA;
    const warehouse = customConfig?.warehouse || process.env.SNOWFLAKE_WAREHOUSE;

    if (account && username && password && database && schema && warehouse) {
      this.config = { account, username, password, database, schema, warehouse };
      this.isConfigured = true;
    }
  }

  private executeQuery(sqlText: string, binds: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.isConfigured) {
        reject(new Error('Snowflake credentials not configured.'));
        return;
      }

      const runStatement = (conn: any) => {
        conn.execute({
          sqlText,
          binds,
          complete: (err, stmt, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        });
      };

      const cachedConn = globalForSnowflake.snowflakeConnection;
      if (cachedConn) {
        runStatement(cachedConn);
      } else {
        const connection = snowflake.createConnection(this.config);
        connection.connect((err, conn) => {
          if (err) {
            reject(err);
            return;
          }
          globalForSnowflake.snowflakeConnection = conn;
          console.log('[SNOWFLAKE] Global connection established and cached.');
          runStatement(conn);
        });
      }
    });
  }

  public async initializeTables() {
    if (!this.isConfigured) return;

    try {
      console.log('[SNOWFLAKE] Initializing tables if not exists...');
      
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS ANT_TELEMETRY (
          EVENT_ID VARCHAR(50) PRIMARY KEY,
          ANT_ID VARCHAR(50),
          SLOT NUMBER,
          BLOCKHASH VARCHAR(100),
          X FLOAT,
          Y FLOAT,
          ACTION VARCHAR(50),
          ENERGY FLOAT,
          CARRIED_ITEM VARCHAR(50),
          TIMESTAMP TIMESTAMP_TZ
        )
      `);

      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS ANT_LIFECYCLE (
          ANT_ID VARCHAR(50) PRIMARY KEY,
          GENERATION NUMBER,
          BIRTH_SLOT NUMBER,
          DEATH_SLOT NUMBER,
          DEATH_REASON VARCHAR(100)
        )
      `);

      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS COLONY_LORE (
          LORE_ID VARCHAR(50) PRIMARY KEY,
          SLOT NUMBER,
          EVENT_TYPE VARCHAR(50),
          DESCRIPTION VARCHAR(1000),
          SEEDED_HASH VARCHAR(100)
        )
      `);

      console.log('[SNOWFLAKE] Database tables verified.');
    } catch (err) {
      console.error('[SNOWFLAKE] Initialization failed:', err);
    }
  }

  public async logTelemetryBatch(records: TelemetryRecord[]) {
    if (!this.isConfigured) {
      localMockDb.insertTelemetryBatch(records);
      return;
    }

    try {
      // In Snowflake, we can construct a batch insert query
      // For simplicity and safety, we execute a multi-value INSERT statement
      if (records.length === 0) return;

      const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const sqlText = `
        INSERT INTO ANT_TELEMETRY 
        (EVENT_ID, ANT_ID, SLOT, BLOCKHASH, X, Y, ACTION, ENERGY, CARRIED_ITEM, TIMESTAMP) 
        VALUES ${placeholders}
      `;

      const binds = records.flatMap(r => [
        r.eventId,
        r.antId,
        r.slot,
        r.blockhash,
        r.x,
        r.y,
        r.action,
        r.energy,
        r.carriedItem,
        r.timestamp
      ]);

      await this.executeQuery(sqlText, binds);
    } catch (err) {
      console.error('[SNOWFLAKE] Telemetry batch insert failed, buffering locally:', err);
      localMockDb.insertTelemetryBatch(records);
    }
  }

  public async logLifecycle(record: LifecycleRecord) {
    if (!this.isConfigured) {
      localMockDb.insertLifecycle(record);
      return;
    }

    try {
      // Upsert into lifecycle
      await this.executeQuery(`
        MERGE INTO ANT_LIFECYCLE AS target
        USING (SELECT ? AS ANT_ID, ? AS GENERATION, ? AS BIRTH_SLOT, ? AS DEATH_SLOT, ? AS DEATH_REASON) AS source
        ON target.ANT_ID = source.ANT_ID
        WHEN MATCHED THEN
          UPDATE SET DEATH_SLOT = source.DEATH_SLOT, DEATH_REASON = source.DEATH_REASON
        WHEN NOT MATCHED THEN
          INSERT (ANT_ID, GENERATION, BIRTH_SLOT, DEATH_SLOT, DEATH_REASON)
          VALUES (source.ANT_ID, source.GENERATION, source.BIRTH_SLOT, source.DEATH_SLOT, source.DEATH_REASON)
      `, [record.antId, record.generation, record.birthSlot, record.deathSlot, record.deathReason]);
    } catch (err) {
      console.error('[SNOWFLAKE] Lifecycle merge failed, fallback to local:', err);
      localMockDb.insertLifecycle(record);
    }
  }

  public async logLore(record: LoreRecord) {
    if (!this.isConfigured) {
      localMockDb.insertLore(record);
      return;
    }

    try {
      await this.executeQuery(`
        INSERT INTO COLONY_LORE (LORE_ID, SLOT, EVENT_TYPE, DESCRIPTION, SEEDED_HASH)
        VALUES (?, ?, ?, ?, ?)
      `, [record.loreId, record.slot, record.eventType, record.description, record.seededHash]);
    } catch (err) {
      console.error('[SNOWFLAKE] Lore log failed, fallback to local:', err);
      localMockDb.insertLore(record);
    }
  }
}
