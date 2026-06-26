# 🌿 NutriSnap — Product Requirements Document & Design Specification

> **Source**: Extracted from `NutriSnap_PRD_DesignDoc.docx`
> **Purpose**: This is the living document. When changes are made from the original docx, they are documented here.
> **Last updated**: 2026-06-11

---

## Changelog (Deviations from original .docx)

| Date | Change | Reason |
|------|--------|--------|
| 2026-06-11 | Replaced `lioness` archetype with `swan` | Design decision — swan better fits graceful/elegant identity |
| 2026-06-11 | Added Welcome / Get Started screen before auth | UX improvement — new users see app value before login |
| 2026-06-11 | Added Continue (fun facts) page in onboarding | Better engagement before form flow |
| 2026-06-11 | Added Diet/Allergies step in onboarding | Personalization improvement |
| 2026-06-11 | Added Transition (social proof) screen in onboarding | Trust-building before plan reveal |
| 2026-06-11 | AI provider: Groq (Llama 4 Scout) instead of Gemini 1.5 Flash | Cost/performance — same JSON schema |
| 2026-06-11 | Home screen redesigned to show "KCAL LEFT" instead of consumed | UX preference from mockups |

---

## Table of Contents
1. Executive Summary
2. Problem & Opportunity
3. Target Users & Personas
4. Feature Specification (MVP)
5. Feature Specification (v1.5 — Archetype System)
6. Screen-by-Screen UX Specification
7. Design System
8. Technical Architecture
9. AI Integration Spec
10. Database Schema
11. Notification System
12. Monetization
13. Success Metrics

---

## 1. Executive Summary

NutriSnap enters a market dominated by cold, clinical apps (MyFitnessPal, Cronometer) and a single iOS-only camera app (Nutrify). Our differentiation is threefold: **camera-first AI nutrition on both Android and iOS from day one**, a warm and friendly design language that feels like a supportive friend, and a unique **Archetype Transformation System** that gives users an identity to grow into — not just a number to hit.

The app is built as a **Freemium** product, collecting labeled food data with every scan that will eventually train a proprietary VLM (Qwen2.5-VL 7B), replacing the API dependency and creating a lasting competitive moat.

---

## 2. Problem & Opportunity

### The Problems We're Solving
- Existing nutrition apps are cold and clinical
- Manual food logging is tedious (80% abandon within 2 weeks)
- No identity/motivation system beyond raw numbers
- Camera-first nutrition scanning only available on iOS (Nutrify)

### Market Opportunity
- Global health & wellness app market: $7.8B (2024)
- Food tracking sub-segment growing 15% YoY
- Cross-platform camera nutrition = untapped on Android

---

## 3. Target Users & Personas

- **The Busy Professional** (25-35): Wants quick food logging, no time for manual entry
- **The Fitness Enthusiast** (18-30): Tracks macros religiously, needs accuracy
- **The Health Newcomer** (30-50): Just starting health journey, needs encouragement
- **The Parent** (28-45): Wants to feed family better, needs family-friendly tracking

---

## 4. Feature Specification — MVP

### Core Features
- Camera-first food scanning with AI nutrition analysis
- Manual food entry as fallback
- Daily calorie and macro tracking (protein, carbs, fat)
- Water tracking (6 cups/day visual)
- Streak system (consecutive days of logging)
- Archetype selection and identity system
- Cheat day mode (guilt-free tracking)
- Google OAuth authentication
- Profile management

### Camera Flow
1. User opens camera tab
2. Points at food → takes photo OR picks from gallery
3. AI analyzes → returns nutrition data in bottom sheet
4. User reviews, edits if needed → confirms
5. Entry saved to daily log with original AI response + corrections

---

## 5. Feature Specification — v1.5 Archetype System

The Archetype System is NutriSnap's identity engine. Users don't just track food — they **become someone**. Each archetype is a complete transformation blueprint: custom macro targets, UI theme, microcopy tone, reminder language, and progression tiers.

### Male Archetypes
| Archetype | Emoji | Style | Protein | Carbs | Fat |
|-----------|-------|-------|---------|-------|-----|
| Wolf | 🐺 | Lean & Athletic | 40% | 35% | 25% |
| Bear | 🐻 | Bulk & Strength | 35% | 45% | 20% |
| Lion | 🦁 | Balanced Power | 38% | 37% | 25% |
| Deer | 🦌 | Endurance & Flexibility | 25% | 55% | 20% |

### Female Archetypes
| Archetype | Emoji | Style | Protein | Carbs | Fat |
|-----------|-------|-------|---------|-------|-----|
| Tigress | 🐯 | Fierce & Lean | 42% | 33% | 25% |
| Phoenix | 🔥 | Rising Transformation | 35% | 40% | 25% |
| Doe | 🦌 | Graceful & Balanced | 28% | 52% | 20% |
| Swan | 🦢 | Elegant & Disciplined | 38% | 37% | 25% |

> **Note**: Swan replaces the original Lioness archetype from the docx.

### Progression Tiers
- **Pup** (0-20 points): Just starting
- **Base** (20-50 points): Building habits
- **Alpha** (50-80 points): Consistent performer
- **Legend** (80-100 points): Elite tracker

---

## 6. Screen-by-Screen UX Specification

All screens follow the earthy warm design language. Background: `#F5F0E8`. Cards: `#EDE6D6`. Dark mode base: `#1C1410`.

### Screen Flow
1. **Welcome** → Get Started / Log In
2. **Continue** → Fun facts carousel (1/6)
3. **Gender Selection** → Male / Female with images (2/6)
4. **Archetype Selection** → 4 cards with images, glowing borders (3/6)
5. **Diet/Allergies** → Allergy chips + diet preferences (4/6)
6. **Transition** → Social proof + stats (5/6)
7. **Plan Reveal** → Archetype + macro breakdown (6/6)
8. **Home** → Daily summary (main screen)
9. **Camera/Scan** → Food scanning
10. **Confirm** → Review + edit nutrition
11. **Progress** → Stats & charts
12. **NutriDex** → Food discovery
13. **Profile** → Settings & weight chart

---

## 7. Design System

### Color Palette — Light Mode
| Token | Value | Usage |
|-------|-------|-------|
| Background | `#F5F0E8` | Page background |
| Card | `#EDE6D6` | Card surfaces |
| Border | `#E0D5C5` | Subtle borders |
| Text Primary | `#3D2B1F` | Dark brown headings |
| Text Secondary | `#6B4C3B` | Body text |
| Text Muted | `#9E8A78` | Labels, hints |
| Olive Green | `#5D7A3E` | Primary action |
| Sunrise Orange | `#E8703A` | Accent, CTA buttons |
| Warm Yellow | `#E8C13A` | Warnings, highlights |

### Color Palette — Dark Mode
Deep warm browns, never pure black. WCAG AA compliant.
| Token | Value | Usage |
|-------|-------|-------|
| Background | `#1C1410` | Dark background |
| Card | `#2C1F16` | Card surfaces |
| Card Mid | `#3D2B1F` | Borders |
| Text | `#F0E8D8` | Light text |
| Text Muted | `#9E8A78` | Muted text |

### Typography
- **Headings**: Nunito 800 Extra Bold / 700 Bold
- **Body**: Inter 400 Regular / 500 Medium / 600 Semi Bold

### Animation Principles
- Spring physics on ALL card entrances — never linear easing
- Reanimated 2 for all gesture-driven animations
- Lottie for celebrations: confetti, streak milestones, archetype unlocks
- Haptics: expo-haptics — impact on food detection, success on goal hit
- Skeleton loaders (not spinners) for all loading states
- Number transitions: rolling counter with withTiming 600ms

---

## 8. Technical Architecture

### Project Structure
```
nutrisnap/
├── app/                    # Expo Router screens
│   ├── auth/               # Login, Register
│   ├── onboarding/         # Multi-step onboarding
│   │   ├── continue.tsx    # Fun facts page
│   │   ├── index.tsx       # Gender → Archetype → Body → Goal flow
│   │   ├── diet.tsx        # Allergies & diet preferences
│   │   └── transition.tsx  # Social proof loading
│   ├── (tabs)/             # Main tab navigator
│   │   ├── home.tsx        # Home / Daily Summary
│   │   ├── camera.tsx      # Camera scan screen
│   │   ├── progress.tsx    # Stats & charts
│   │   ├── nutridex.tsx    # Food discovery
│   │   └── profile.tsx     # Profile & settings
│   ├── confirm.tsx         # Nutrition confirm (modal)
│   └── future-you.tsx      # Plan reveal screen
├── components/
│   ├── ui/                 # Shared UI components
│   └── archetype/          # Archetype-specific components
├── lib/
│   ├── gemini.ts           # AI API client (Groq)
│   ├── supabase.ts         # Supabase client
│   ├── tdee.ts             # TDEE + macro calculations
│   └── notifications.ts   # Notification system
├── stores/                 # Zustand state stores
├── hooks/                  # Custom React hooks
├── constants/              # Design tokens & configs
├── types/                  # TypeScript definitions
└── assets/
    ├── archetypes/         # Archetype images (wolf, bear, lion, deer, tigress, phoenix, doe, swan, male, female)
    └── UI mockups/         # Design reference images
```

### Key Dependencies
| Package | Priority | Phase | Notes |
|---------|----------|-------|-------|
| expo-camera | P0 | MVP | Camera with permissions |
| expo-router | P0 | MVP | File-based navigation |
| @supabase/supabase-js | P0 | MVP | Database, auth, storage |
| zustand | P0 | MVP | State management |
| react-native-reanimated | P0 | MVP | Animations |
| react-native-svg | P0 | MVP | Progress rings |
| expo-notifications | P1 | MVP | Push reminders |
| expo-haptics | P1 | MVP | Tactile feedback |
| @gorhom/bottom-sheet | P0 | MVP | Confirm screen |

---

## 9. AI Integration Spec

### System Prompt
```
You are an expert nutritionist analyzing food photos for a health tracking app.

Analyze the image and return ONLY a valid JSON object:
{
  "meal_name": "descriptive name",
  "food_items": [
    {
      "name": "string",
      "quantity": "e.g. 1 cup / 200g",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number,
      "confidence": "high | medium | low"
    }
  ],
  "total_calories": number,
  "total_protein_g": number,
  "total_carbs_g": number,
  "total_fat_g": number,
  "notes": "observations"
}

Rules:
- Be CONSERVATIVE with portion estimates
- List each component separately
- If no food detected: { "error": "no_food_detected" }
- Return ONLY JSON. No markdown. No explanation.
```

### Data Collection Strategy
- Store raw AI response in `food_entries.raw_gemini_response` (JSONB)
- Store user edits as diff in `food_entries.user_corrections` (JSONB)
- Store `food_entries.user_accepted_without_edit` (boolean)
- Store food image in storage at `/food-images/{user_id}/{timestamp}.jpg`
- Target: 50,000 labeled images before starting fine-tuning

---

## 10. Database Schema

```sql
-- PROFILES
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users,
  name            TEXT,
  age             INT,
  weight_kg       FLOAT,
  height_cm       FLOAT,
  goal_type       TEXT CHECK (goal_type IN ('cut','maintain','bulk')),
  calorie_goal    INT,
  protein_goal    INT,
  carb_goal       INT,
  fat_goal        INT,
  archetype       TEXT,
  archetype_tier  TEXT,
  streak_count    INT DEFAULT 0,
  last_logged_date DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- FOOD ENTRIES
CREATE TABLE food_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES profiles(id),
  meal_name             TEXT,
  food_items            JSONB,
  total_calories        INT,
  protein_g             FLOAT,
  carbs_g               FLOAT,
  fat_g                 FLOAT,
  fiber_g               FLOAT,
  image_url             TEXT,
  raw_gemini_response   JSONB,
  user_corrections      JSONB,
  user_accepted_without_edit BOOLEAN DEFAULT false,
  is_cheat_day          BOOLEAN DEFAULT false,
  logged_at             TIMESTAMPTZ DEFAULT NOW()
);

-- DAILY SUMMARIES
CREATE TABLE daily_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id),
  date            DATE,
  total_calories  INT,
  total_protein   FLOAT,
  total_carbs     FLOAT,
  total_fat       FLOAT,
  water_ml        INT DEFAULT 0,
  is_cheat_day    BOOLEAN DEFAULT false,
  goal_met        BOOLEAN,
  UNIQUE(user_id, date)
);

-- WEIGHT LOGS
CREATE TABLE weight_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id),
  weight_kg   FLOAT,
  logged_at   TIMESTAMPTZ DEFAULT NOW()
);

-- NUTRIDEX ENTRIES
CREATE TABLE nutridex_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id),
  food_name   TEXT,
  category    TEXT,
  times_scanned INT DEFAULT 1,
  first_scanned TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 11. Notification System

All notifications use Expo Notifications. Copy is archetype-aware.

| Feature | Priority | Phase | Notes |
|---------|----------|-------|-------|
| Meal Reminder | P1 | MVP | Daily at chosen time |
| Water Reminder | P1 | MVP | Every 2h, 8am-8pm |
| Streak Milestone | P1 | MVP | Day 7, 14, 30, 60, 100 |
| Goal Hit | P1 | MVP | When daily goal met |
| Dynamic Goal Update | P0 | v1.5 | Steps → extra calories |
| Archetype Tier Up | P0 | v1.5 | On tier progression |
| Weekly Summary | P2 | v1.5 | Sunday evening review |

---

## 12. Monetization Strategy

**Launch Free. Monetize at 1,000 Active Users.**

Don't add paywalls in MVP. Need ratings, reviews, and organic word-of-mouth first. Design with monetization in mind from day one, but ship fully free. Add paywall at Month 3 with social proof.

---

## 13. Success Metrics

### MVP Launch Targets (Week 6–12)
- 500 downloads first month
- 30% D7 retention
- 3 scans/user/day average
- 4.5+ App Store rating

### PostHog Events to Track (Day One)
- `scan_initiated`, `scan_completed`, `scan_failed` — Camera funnel
- `nutrition_confirmed`, `nutrition_edited`, `nutrition_cancelled` — Trust bridge
- `cheat_day_activated` — Viral feature engagement
- `archetype_selected` — Onboarding completion
- `streak_milestone_7`, `streak_milestone_30` — Retention signal
- `goal_hit_today` — Core product success
- `paywall_seen`, `paywall_converted` — Monetization funnel (v2)

---

*NutriSnap PRD v1.1 · Living Document · 🌿*
