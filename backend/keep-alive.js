/**
 * keep-alive.js
 * Run this locally or on any cron service to prevent Render free tier
 * from spinning down the backend.
 *
 * Usage (locally): node keep-alive.js
 * Usage (cron): set up on cron-job.org to call your /api/health URL every 10 min
 */

const BACKEND_URL = process.env.BACKEND_URL || 'https://your-backend.onrender.com/api/health';
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

async function ping() {
  try {
    const res = await fetch(BACKEND_URL);
    const data = await res.json();
    console.log(`[${new Date().toISOString()}] Ping OK — uptime: ${data.uptime}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Ping FAILED:`, err.message);
  }
}

ping();
setInterval(ping, INTERVAL_MS);
console.log(`Keep-alive pinging ${BACKEND_URL} every ${INTERVAL_MS/60000} minutes`);