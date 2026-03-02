# NutriSnap 🍎

A mobile food & health tracker built with React Native (Expo SDK 55), featuring AI-powered food scanning via Google Gemini, archetype-based nutrition tracking, and a beautiful earthy design system.

## Features

- 📸 **AI Food Scanning**: Point your camera at food, get instant nutrition data via Gemini 1.5 Flash
- 🦁 **8 Archetypes**: Personalized macro ratios (Wolf, Bear, Lion, Deer, Tigress, Phoenix, Doe, Lioness)
- 📊 **Daily Tracking**: Calories, macros, water intake, and habits
- 🔥 **Streak System**: Gamified consistency with archetype-themed notifications
- 🗺️ **FoodMap**: Discover your food world - see everything you've scanned
- 🌙 **Dark Mode**: Full theme support with earthy color palette

## Tech Stack

- **Framework**: Expo SDK 54 (React Native)
- **Language**: TypeScript (strict mode)
- **State**: Zustand
- **Navigation**: Expo Router v3
- **Backend**: Supabase (Postgres + Auth + Storage)
- **AI**: Google Gemini 1.5 Flash
- **Animations**: React Native Reanimated 3
- **Analytics**: PostHog

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo Go app on your device (for testing)
- Supabase account
- Google Cloud Console account (for OAuth + Gemini)

### Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <repo-url>
   cd nutrisnap
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Set up environment variables**
   \`\`\`bash
   cp .env.example .env.local
   \`\`\`
   Then fill in your credentials (see Setup Guides below).

4. **Start the development server**
   \`\`\`bash
   npx expo start
   \`\`\`

5. **Scan the QR code** with Expo Go on your device

## Setup Guides

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** and copy:
   - Project URL → \`EXPO_PUBLIC_SUPABASE_URL\`
   - Anon/Public key → \`EXPO_PUBLIC_SUPABASE_ANON_KEY\`
3. Run the SQL schema (see \`docs/schema.sql\`)
4. Enable Google OAuth in **Authentication > Providers**

### 2. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable **Google+ API**
4. Go to **APIs & Services > Credentials**
5. Create OAuth 2.0 Client IDs:
   - **Web**: Set authorized redirect URI to your Supabase URL + \`/auth/v1/callback\`
   - **Android**: Add your package name and SHA-1 fingerprint
   - **iOS**: Add your bundle ID
6. Copy client IDs to your \`.env.local\`

### 3. Gemini API Setup

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Click **Get API Key**
3. Create a new API key
4. Copy to \`EXPO_PUBLIC_GEMINI_API_KEY\`

### 4. PostHog Setup (Optional)

1. Create account at [posthog.com](https://posthog.com)
2. Go to **Project Settings**
3. Copy API Key and Host to \`.env.local\`

## Database Schema

Run this SQL in your Supabase SQL Editor:

\`\`\`sql
-- See docs/schema.sql for complete schema
\`\`\`


## Scripts

\`\`\`bash
npm start          # Start Expo dev server
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run web        # Run on web (limited features)
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript check
\`\`\`


## License

MIT License - see LICENSE file
