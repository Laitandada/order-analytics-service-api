/**
 * verify-connections.ts
 *
 * Standalone script to verify that both PRIMARY_DATABASE_URL and
 * READ_DATABASE_URL connect successfully and return expected results.
 *
 * Usage:
 *   npx tsx src/database/verify-connections.ts
 *
 * This script does NOT modify any data. It performs read-only checks only.
 */
import pg from 'pg';

interface ConnectionResult {
  name: string;
  url: string;
  connected: boolean;
  serverVersion?: string;
  isInRecovery?: boolean; // true = replica (hot standby), false = primary
  error?: string;
}

async function checkConnection(
  name: string,
  connectionString: string,
): Promise<ConnectionResult> {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();

    const versionResult = await client.query<{ version: string }>(
      'SELECT version()',
    );
    const recoveryResult = await client.query<{ pg_is_in_recovery: boolean }>(
      'SELECT pg_is_in_recovery()',
    );

    const serverVersion = versionResult.rows[0]?.version ?? 'unknown';
    const isInRecovery = recoveryResult.rows[0]?.pg_is_in_recovery ?? false;

    await client.end();

    return {
      name,
      url: redact(connectionString),
      connected: true,
      serverVersion,
      isInRecovery,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { name, url: redact(connectionString), connected: false, error };
  }
}

function redact(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return url.replace(/:([^@]+)@/, ':***@');
  }
}

async function main() {
  const primaryUrl =
    process.env.PRIMARY_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
  const replicaUrl =
    process.env.READ_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

  if (!primaryUrl) {
    console.error('❌  PRIMARY_DATABASE_URL (or DATABASE_URL) is not set');
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('  Database Connection Verification');
  console.log('═══════════════════════════════════════════════\n');

  const [primary, replica] = await Promise.all([
    checkConnection('PRIMARY', primaryUrl),
    checkConnection('REPLICA ', replicaUrl),
  ]);

  for (const result of [primary, replica]) {
    console.log(`[${result.name}]  ${result.url}`);
    if (result.connected) {
      const role = result.isInRecovery
        ? '🔵 hot-standby (replica)'
        : '🟢 read-write (primary)';
      console.log(`  ✅  Connected`);
      console.log(`  Role:    ${role}`);
      console.log(
        `  Version: ${result.serverVersion?.split(' ').slice(0, 2).join(' ')}`,
      );
    } else {
      console.log(`  ❌  Failed: ${result.error}`);
    }
    console.log();
  }

  // Warn when both URLs resolve to the same server
  if (primary.connected && replica.connected && primary.url === replica.url) {
    console.log(
      '⚠️   Both PRIMARY_DATABASE_URL and READ_DATABASE_URL point to the same\n' +
        '    instance. This is expected in local development.\n' +
        '    In production, READ_DATABASE_URL should point to a hot-standby replica.\n',
    );
  }

  const allOk = primary.connected && replica.connected;
  console.log(
    allOk
      ? '✅  All connections verified.\n'
      : '❌  One or more connections failed.\n',
  );
  process.exit(allOk ? 0 : 1);
}

void main();
