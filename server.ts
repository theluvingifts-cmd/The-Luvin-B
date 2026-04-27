
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Import API handlers
import sendTelegramHandler from './api/send-telegram.js';
import sendEmailHandler from './api/send-email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.post('/api/send-telegram', async (req, res) => {
    try {
      await sendTelegramHandler(req, res);
    } catch (error) {
      console.error('Error in /api/send-telegram:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/send-email', async (req, res) => {
    try {
      await sendEmailHandler(req, res);
    } catch (error) {
      console.error('Error in /api/send-email:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files from dist
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('Production build not found. Please run npm run build.');
      // Fallback for dev if dist is missing but NODE_ENV is production
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
