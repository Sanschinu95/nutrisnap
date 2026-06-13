# README_Codex_V1_Rework.md

## Project Goal

NutriSnap should not feel like a calorie tracker.

It should feel like an archetype-driven nutrition coach that helps users become the healthiest version of themselves.

The app already works.

This rework is focused on:

* Better UX
* Better retention
* Better engagement
* Better visual hierarchy
* Stronger archetype identity

No functionality should break.

---

# Hard Constraints

DO NOT:

* Add npm packages
* Modify package.json
* Change backend APIs
* Change database schema
* Change authentication
* Change onboarding flow
* Change navigation structure
* Change existing calculations
* Change archetype calculations
* Add social feed
* Add achievements
* Add transformation timeline
* Add experimental dependencies

Use only existing components, libraries, and architecture.

---

# Product Philosophy

Current Experience:

Scan Food
→ View Calories
→ Leave

Desired Experience:

Scan Food
→ Understand Impact
→ Feel Progress
→ Receive Insight
→ Return Tomorrow

Every screen should reinforce identity.

Users should feel:

🔥 Phoenix

🦢 Swan

🐯 Tigress

🌿 Doe

Not:

"I am tracking calories."

---

# Theme

## Light Mode

Background: #F5F0E8

Cards: #EDE6D6

Primary: #5D7A3E

Accent: #E8703A

Text: #2F241E

Secondary Text: #6E6258

---

## Dark Mode

Background: #120907

Cards: #2A1811

Elevated Cards: #3A241A

Primary: #5D7A3E

Accent: #E8703A

Text: #F5EEE5

Secondary Text: #BCAEA0

---

# Home Screen Rework

## Archetype Hero Section

Move archetype identity to the top.

Examples:

Phoenix:
Rise Again Today

Swan:
Balance Creates Beauty

Doe:
Gentle Progress Matters

Tigress:
Fuel The Fire

Display archetype artwork prominently.

Archetype should become the first thing users see.

---

## Daily Coach Card

Place below greeting.

Examples:

Phoenix:
"Every meal is a chance to rise."

Tigress:
"Tigresses don't skip meals."

Swan:
"Small choices create elegant results."

Doe:
"Consistency beats perfection."

This should feel like coaching.

Not a notification.

---

## Daily Insight Card

Place above nutrition data.

Examples:

"You're 30g away from today's protein goal."

"Hydration is lower than yesterday."

"You've logged one meal today."

"Today's choices build tomorrow's results."

Rotate insights.

Use existing data only.

---

# Nutrition Ring Rework

Keep all existing calculations.

Only redesign presentation.

Center:

Calories Remaining

Large readable number.

Around ring:

* Protein Progress
* Carb Progress
* Fat Progress

Use subtle color-coded progress segments.

Must feel premium and modern.

---

# NutriScore (Frontend Only)

Create a simple score.

No backend changes.

Based on:

* Protein completion
* Hydration completion
* Calorie adherence

Display:

NutriScore

82 / 100

And:

✓ Protein On Track

✓ Hydration Good

⚠ Fiber Could Improve

Purpose:

One understandable metric.

---

# Hydration Garden

Replace boring water display.

Show:

6 droplets

Example:

💧💧💧⚪⚪⚪

Fill droplets according to hydration progress.

Below:

0.0L / 2.5L

Add archetype message.

Phoenix:
"Fuel the flame."

Swan:
"Balance starts with water."

Doe:
"Nourish your roots."

Tigress:
"Hydration powers performance."

---

# Empty States

Replace generic empty states.

## Meals

"Ready for your first meal scan?"

Show plate illustration.

Show scan button.

---

## Progress

"Your story begins with today's choices."

---

## Hydration

"Your body is waiting for water."

---

## Profile

"Let's build your nutrition journey."

---

# Progress Tab Rework

Current screen feels like a planner.

Convert into a progress dashboard.

---

## Section 1

Weekly Summary

Display:

* Meals Logged
* Protein Goals Hit
* Water Goals Hit
* Current Streak

---

## Section 2

Nutrition Trends

Display:

* Calories
* Protein
* Carbs
* Fat

Use existing chart implementation.

If unavailable use trend cards.

---

## Section 3

Smart Insights

Examples:

"You hit protein goals 4 days this week."

"Most calories are consumed at dinner."

"Hydration improved by 20%."

Only use existing data.

---

## Section 4

Consistency Score

Frontend calculation only.

Based on:

* Meal Logging
* Protein Goals
* Hydration Goals

Display:

65 / 100

With interpretation.

Examples:

Excellent

Good

Needs Improvement

---

# Meal Plan Rework

Current layout resembles a spreadsheet.

Convert meals into cards.

Card Structure:

Breakfast

Calories

Protein

Food List

Better spacing.

Better typography.

No logic changes.

---

# Scan Result Enhancement

After meal scan:

Show contextual archetype feedback.

Examples:

Phoenix:

"High energy meal."

"Keep rising."

"Add 15g more protein for maximum recovery."

---

Tigress:

"Excellent fuel for strength."

---

Swan:

"Balanced nutrition choice."

---

Doe:

"Simple and sustainable."

Rule-based frontend messaging is acceptable.

No AI changes required.

---

# Fun Fuel Facts

Add small card near bottom of Home.

Rotate facts.

Examples:

"Today's calories could power a 15km bike ride."

"Enough energy to climb 90 floors."

"Enough energy for a 30-minute swim."

Static fact pool is acceptable.

---

# Community Presence Card

Visual only.

No backend.

No social functionality.

Examples:

"842 Phoenixes logged meals today."

"134 Swans completed hydration goals."

"520 Tigresses hit protein targets."

Use rotating mock numbers.

Purpose:

Make the app feel alive.

---

# Profile Rework

Profile should feel like a character page.

Top:

Archetype artwork

Archetype title

Archetype description

Examples:

Phoenix
Transformation Journey

Swan
Graceful Discipline

Doe
Mindful Sustainability

Tigress
Lean Strength

---

Display:

* Current Weight
* Goal Weight
* Meals Logged
* Water Consumed
* Days Active
* Current Streak

Modern card layout.

Remove dead space.

Keep settings section unchanged.

---

# Microcopy Rework

Avoid generic fitness language.

Instead of:

"Log Meal"

Use:

"Fuel Your Journey"

Instead of:

"Track Water"

Use:

"Hydrate Your Archetype"

Instead of:

"Progress"

Use:

"Your Journey"

Small language improvements should reinforce identity.

---

# Micro Interactions

Use only existing animation capabilities.

Add:

* Button press scale
* Card press scale
* Progress animations
* Hydration fill animations
* Fade transitions

No new animation libraries.

---

# Success Criteria

A user opening NutriSnap should feel:

"This app understands who I want to become."

Not:

"This is another calorie counter."

Preserve all existing functionality while improving engagement, retention, and archetype immersion.
