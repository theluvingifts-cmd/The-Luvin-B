
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# The Luvin - Personalized LEGO Frame Gifts

A web application for creating and purchasing personalized LEGO mini-figure frame gifts.

View your app in AI Studio: https://ai.studio/apps/drive/1tsJnc9_dK9c10AQasBaxhJ0lLY37VWzy

## 🚀 Deployment Guide (Vercel)

Follow these steps to deploy your application to Vercel.

### 1. Prerequisites (You have done this)
- Firebase Project created.
- Authentication enabled (Email/Password).
- Firestore Database enabled.
- Storage enabled & CORS configured via Cloud Shell.

### 2. Deploy Code
1. Push this code to a GitHub repository.
2. Log in to [Vercel](https://vercel.com).
3. Click **"Add New..."** -> **"Project"**.
4. Import your GitHub repository.

### 3. Environment Variables (Critical for AI)
In the Vercel Project Settings (before clicking Deploy or in Settings -> Environment Variables):

Add the following variable:
- **Key:** `GEMINI_API_KEY`
- **Value:** (Your Google Gemini API Key)

*Note: The Firebase config is currently hardcoded in `config/firebase.ts` for simplicity. For a production app, you should also move those values to Environment Variables.*

### 4. Verify Installation
After deployment is complete:
1. Open your live website URL.
2. Log in to the `/admin` page (Default: create an account via Firebase Console or use the hardcoded admin email if applicable).
3. Go to **Dashboard** and click the **"⚡ Kiểm tra hệ thống"** button to verify that Firebase Storage and CORS are working correctly.

## 🛠️ Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set the `GEMINI_API_KEY` in `.env.local` (optional, for AI features).
3. Run the app:
   ```bash
   npm run dev
   ```
