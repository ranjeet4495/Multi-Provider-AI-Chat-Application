import mysql from 'mysql2/promise';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function init() {
  console.log('Connecting to MySQL...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    multipleStatements: true
  });

  console.log('Connected to MySQL. Reading schema.sql...');
  const sql = fs.readFileSync('./schema.sql', 'utf8');

  console.log('Executing SQL statements to initialize schema and seed data...');
  await connection.query(sql);
  console.log('Successfully initialized database and populated seed tables!');
  
  await connection.end();
}

init().catch((err) => {
  console.error('Initialization failed:', err.message);
  process.exit(1);
});
