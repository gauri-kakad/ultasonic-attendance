const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI;

const connectDB = async () => {
  // 🚨 Fail fast if env variable is missing
  if (!MONGO_URI) {
    console.error('❌ MONGODB_URI is NOT defined');
    process.exit(1);
  }

  // 🔍 Debug log (remove later if you want)
  console.log('Using Mongo URI:', MONGO_URI);

  const options = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    retryWrites: true,
  };

  const connect = async (attempt = 1) => {
    try {
      const conn = await mongoose.connect(MONGO_URI, options);
      console.log('MongoDB Connected to', conn.connection.host);
    } catch (error) {
      console.error(`MongoDB Connection failed (attempt ${attempt}) —`, error.message);

      if (attempt < 5) {
        const delay = attempt * 2000;
        console.log(`Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        return connect(attempt + 1);
      }

      console.error('All retry attempts failed. Exiting.');
      process.exit(1);
    }
  };

  await connect();

  // 🔁 Reconnect logic
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB Disconnected. Reconnecting...');
    setTimeout(() => connect(), 3000);
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB Error —', err.message);
  });
};

module.exports = connectDB;
