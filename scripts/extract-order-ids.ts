import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

async function main() {
  const connectionString = process.env.PRIMARY_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL or PRIMARY_DATABASE_URL is not defined in environment variables.');
    process.exit(1);
  }

  console.log(`Connecting to PostgreSQL to extract random order IDs...`);
  const client = new pg.Client({ connectionString });
  
  try {
    await client.connect();
    
    // Select 2,000 random order IDs and their dates from the Order table
    const query = 'SELECT id, "orderedAt" FROM "Order" ORDER BY random() LIMIT 2000;';
    const res = await client.query<{ id: string; orderedAt: Date | string }>(query);
    
    const ids = res.rows.map(row => ({
      id: row.id,
      orderedAt: new Date(row.orderedAt).toISOString()
    }));
    console.log(`Extracted ${ids.length} valid order records.`);

    if (ids.length === 0) {
      console.warn('Warning: No orders found in the database. Ensure database has been seeded.');
    }

    // Ensure directory exists
    const outputDir = path.resolve('load-test');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'order_ids.json');
    fs.writeFileSync(outputPath, JSON.stringify(ids, null, 2), 'utf-8');
    console.log(`Successfully wrote order IDs to ${outputPath}`);
  } catch (error) {
    console.error('Error extracting order IDs:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

void main();
