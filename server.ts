
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Constants
const PORT = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for dynamic imports with fallback
async function getFirebase() {
  try {
    // Try .js first (for production/compiled), then .ts (for tsx/dev)
    try {
      return await import('./config/firebase.js');
    } catch {
      return await import('./config/firebase.ts');
    }
  } catch (err) {
    console.error('Failed to import firebase config:', err);
    throw err;
  }
}

// Import API handlers
import sendTelegramHandler from './api/send-telegram.js';
import sendEmailHandler from './api/send-email.js';

async function startServer() {
  const app = express();

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

  // Meta Injection Handler Logic (Shared for Dev/Prod)
  const handleMetaInjection = async (req: express.Request, res: express.Response, htmlSource: string, isVite: boolean = false, viteInstance?: any) => {
    const url = req.originalUrl;
    
    // Skip internal Vite transformation requests or static assets
    if (url.includes('?') || url.includes('.')) {
      // Only allow templates which might have dots in IDs (unlikely but safe)
      const isTemplateUrl = /\/collection\/[^/]+\/(tpl_[^/?#]+)/.test(url);
      if (!isTemplateUrl) return false;
    }

    const tplMatch = url.match(/\/collection\/[^/]+\/(tpl_[^/?#]+)/);
    
    // Check if it's a crawler or a browser navigation request for HTML
    const userAgent = req.header('user-agent') || '';
    const isCrawler = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|ZaloExternalHit|Slackbot|TelegramBot/i.test(userAgent);
    const isHtmlRequest = req.headers.accept?.includes('text/html');

    if (!isCrawler && !isHtmlRequest) return false;

    try {
      const { db } = await getFirebase();
      const { doc, getDoc } = await import('firebase/firestore');
      
      // Defaults
      let title = "The Luvin - Thương hiệu quà tặng tinh tế";
      let description = "Tạo nên món quà độc bản từ những mảnh ghép LEGO. Lưu giữ kỷ niệm theo cách riêng của bạn, tinh tế và đầy cảm xúc.";
      let image = "https://firebasestorage.googleapis.com/v0/b/the-luvin.firebasestorage.app/o/uploads%2F1766151159202_bl4wsh_2.png?alt=media&token=6b6fbdcd-74d5-45da-a139-a0c977a43d1d";

      // Parallel fetch for efficiency
      const configPromise = getDoc(doc(db, 'config', 'general'));
      const tplPromise = tplMatch ? getDoc(doc(db, 'templates', tplMatch[1])) : Promise.resolve(null);
      
      const [configSnap, tplSnap] = await Promise.all([configPromise, tplPromise]);

      if (configSnap.exists()) {
        const config = configSnap.data();
        title = config.seoTitle || title;
        description = config.seoDescription || description;
        image = config.seoImageUrl || image;
      }

      if (tplSnap && tplSnap.exists()) {
        const template = tplSnap.data();
        title = `${template.name} - The Luvin`;
        if (template.description) description = template.description;
        if (template.image) image = template.image;
      }

      let html = htmlSource;
      if (isVite && viteInstance) {
        html = await viteInstance.transformIndexHtml(url, html);
      }

      // Final safety check: ensure no raw placeholders are served
      const finalTitle = title || "The Luvin - Thương hiệu quà tặng tinh tế";
      const finalDesc = description || "Tạo nên món quà độc bản từ những mảnh ghép LEGO.";
      const finalImage = image || "https://firebasestorage.googleapis.com/v0/b/the-luvin.firebasestorage.app/o/uploads%2F1766151159202_bl4wsh_2.png?alt=media&token=6b6fbdcd-74d5-45da-a139-a0c977a43d1d";

      html = html
        .replace(/__OG_TITLE__/g, finalTitle)
        .replace(/__OG_DESCRIPTION__/g, finalDesc)
        .replace(/__OG_IMAGE__/g, finalImage);

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      return true;
    } catch (error) {
      console.error('[Meta] Error injecting tags:', error);
      
      // Even on error, if we are handling a potential HTML request, 
      // we must replace placeholders to avoid showing raw tags
      try {
        let html = htmlSource;
        if (isVite && viteInstance) html = await viteInstance.transformIndexHtml(url, html);
        
        html = html
          .replace(/__OG_TITLE__/g, "The Luvin - Personalized Lego Gifts")
          .replace(/__OG_DESCRIPTION__/g, "Unique personalized Lego gifts.")
          .replace(/__OG_IMAGE__/g, "");
          
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        return true;
      } catch (innerError) {
        return false;
      }
    }
  };

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Custom Meta Middleware BEFORE Vite
    app.use(async (req, res, next) => {
      const htmlSource = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
      const handled = await handleMetaInjection(req, res, htmlSource, true, vite);
      if (!handled) next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      // Serve static assets EXCEPT index.html
      app.use(express.static(distPath, { index: false }));
      
      app.get('*', async (req, res, next) => {
        const htmlSource = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        const handled = await handleMetaInjection(req, res, htmlSource);
        if (!handled) {
          res.sendFile(path.join(distPath, 'index.html'));
        }
      });
    } else {
      console.warn('Production build not found. Starting Vite fallback...');
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
