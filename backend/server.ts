import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import logger from './utils/logger.js';
import { getDb } from './db/connection.js';
import verdictRouter from './routes/verdict.js';

// Resolve paths for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Enable dynamic CORS for frontend (production and local preview support)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(ao => origin.startsWith(ao)) || 
                      origin.endsWith('.vercel.app') || 
                      origin.includes('localhost:3000') ||
                      origin.includes('127.0.0.1:3000');
                      
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, true); // fallback to true in dev/demo environments to prevent strict blockages
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Register routes
app.use('/api/verdict', verdictRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled server exception:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Initialize DB and start server
async function bootstrap() {
  try {
    // Proactively verify SQLite connectivity on launch
    await getDb();
    
    app.listen(PORT, () => {
      logger.success(`===================================================`);
      logger.success(` VERDICT Backend running on: http://localhost:${PORT}`);
      logger.success(` Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.success(`===================================================`);
    });
  } catch (error) {
    logger.error('Failed to bootstrap Express backend:', error);
    process.exit(1);
  }
}

bootstrap();
