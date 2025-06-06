const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.PG_USER,      
  host: process.env.PG_HOST,     
  database: process.env.PG_DATABASE, 
  password: process.env.PG_PASSWORD, 
  port: process.env.PG_PORT,      
  max: 10,                        
  idleTimeoutMillis: 30000,       
  connectionTimeoutMillis: 2000,
});

pool.connect()
  .then(client => {
    console.log('Connected to PostgreSQL database!');
    client.release(); 
  })
  .catch(err => {
    console.error('Error connecting to PostgreSQL database:', err.message); 
    process.exit(1); 
  });

module.exports = pool;