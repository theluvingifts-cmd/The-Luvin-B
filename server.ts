
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
    
    // In development mode, we still want to provide dynamic meta tags for local social sharing tests
    // although social crawlers won't hit localhost. 
    // However, the cleanest way in Vite middlewareMode is usually a custom middleware
    app.use(async (req, res, next) => {
      const url = req.originalUrl;
      const tplMatch = url.match(/\/collection\/[^/]+\/(tpl_[^/?]+)/);
      
      if (tplMatch) {
         try {
           const templateId = tplMatch[1];
           const { db } = await import('./config/firebase.js');
           const { doc, getDoc } = await import('firebase/firestore');
           
           // Fetch both app config for defaults and specific template
           const [configSnap, tplSnap] = await Promise.all([
             getDoc(doc(db, 'config', 'general')),
             getDoc(doc(db, 'templates', templateId))
           ]);
           
           const storeConfig = configSnap.exists() ? configSnap.data() : {};
           const template = tplSnap.exists() ? tplSnap.data() : null;
           
           const title = template ? `${template.name} - The Luvin` : (storeConfig.seoTitle || "The Luvin - Personalized Lego Gifts");
           const description = template ? (template.description || `Mẫu thiết kế ${template.name} độc bản tại The Luvin.`) : (storeConfig.seoDescription || "Unique Lego gifts.");
           const image = (template && template.image) ? template.image : (storeConfig.seoImageUrl || "");
           
           let html = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
           // Apply transformations that Vite normally does
           html = await vite.transformIndexHtml(url, html);
           
           html = html
             .replace(/__OG_TITLE__/g, title)
             .replace(/__OG_DESCRIPTION__/g, description)
             .replace(/__OG_IMAGE__/g, image);
           
           res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
           return;
         } catch (e) {
           console.error("Meta injection error (dev):", e);
         }
      }
      
      // Fallback for home or other pages - inject defaults
      if (!res.writableEnded && req.accepts('html')) {
        try {
           const { db } = await import('./config/firebase.js');
           const { doc, getDoc } = await import('firebase/firestore');
           const configSnap = await getDoc(doc(db, 'config', 'general'));
           const storeConfig = configSnap.exists() ? configSnap.data() : {};
           
           const title = storeConfig.seoTitle || "The Luvin - Personalized Lego Gifts";
           const description = storeConfig.seoDescription || "Unique Lego gifts.";
           const image = storeConfig.seoImageUrl || "";
           
           let html = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
           html = await vite.transformIndexHtml(url, html);
           
           html = html
             .replace(/__OG_TITLE__/g, title)
             .replace(/__OG_DESCRIPTION__/g, description)
             .replace(/__OG_IMAGE__/g, image);
           
           res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
           return;
        } catch (e) {
          next();
        }
      } else {
        next();
      }
    });
  } else {
    // Production: serve static files from dist
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath, { index: false })); // Don't serve index.html directly to allow our custom handler
      
      app.get('*', async (req, res) => {
        const url = req.url;
        const tplMatch = url.match(/\/collection\/[^/]+\/(tpl_[^/?]+)/);
        
        try {
           const { db } = await import('./config/firebase.js');
           const { doc, getDoc } = await import('firebase/firestore');
           
           let title = "The Luvin - Personalized Lego Gifts";
           let description = "Unique Lego gifts.";
           let image = "";
           
           const configSnap = await getDoc(doc(db, 'config', 'general'));
           const storeConfig = configSnap.exists() ? configSnap.data() : {};
           title = storeConfig.seoTitle || title;
           description = storeConfig.seoDescription || description;
           image = storeConfig.seoImageUrl || image;

           if (tplMatch) {
             const templateId = tplMatch[1];
             const tplSnap = await getDoc(doc(db, 'templates', templateId));
             if (tplSnap.exists()) {
               const template = tplSnap.data();
               title = `${template.name} - The Luvin`;
               description = template.description || description;
               if (template.image) image = template.image;
             }
           }
           
           let html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
           html = html
             .replace(/__OG_TITLE__/g, title)
             .replace(/__OG_DESCRIPTION__/g, description)
             .replace(/__OG_IMAGE__/g, image);
           
           res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
        } catch (error) {
           console.error('Error serving index.html in production:', error);
           res.sendFile(path.join(distPath, 'index.html'));
        }
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
