const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ultrasonic_attendance';

const connectDB = async () => {
  const options = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    retryWrites: true,
  };

  const connect = async (attempt = 1) => {
    try {
      const conn = await mongoose.connect(MONGO_URI, options);
      console.log('  MongoDB  : Connected to', conn.connection.host);
    } catch (error) {
      console.error(`  MongoDB  : Connection failed (attempt ${attempt}) —`, error.message);
      if (attempt < 5) {
        const delay = attempt * 2000;
        console.log(`  MongoDB  : Retrying in ${delay/1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        return connect(attempt + 1);
      }
      console.error('  MongoDB  : All retry attempts failed. Exiting.');
      process.exit(1);
    }
  };

  await connect();

  // reconnect on disconnect
  mongoose.connection.on('disconnected', () => {
    console.warn('  MongoDB  : Disconnected. Reconnecting...');
    setTimeout(() => connect(), 3000);
  });

  mongoose.connection.on('error', (err) => {
    console.error('  MongoDB  : Error —', err.message);
  });
};

module.exports = connectDB;