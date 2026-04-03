# AI Image Generation Prompts for DevPulse Icon

## 🎨 PROMPT FOR GEMINI / AI IMAGE GENERATORS

Use these prompts with Google AI Studio, DALL-E, Midjourney, or any AI image generator.

---

## ⭐ PRIMARY PROMPT (Most Detailed)

```
Create a professional VS Code extension icon, 128x128 pixels, flat design.

COMPOSITION:
- Solid blue circular background (#1d4ed8, deep royal blue)
- White shield icon in the center (security symbol)
- Overlaid with ascending graph/chart lines in yellow (#fbbf24) and light blue (#60a5fa)
- Letters "DP" in bold sans-serif font inside the shield
- Minimal, clean, modern design

STYLE:
- Flat design (no gradients, no 3D effects)
- High contrast for visibility at small sizes
- Professional software icon aesthetic
- Similar style to VS Code, GitHub, Stripe icons
- Sharp edges, crisp lines

COLORS:
- Background: #1d4ed8 (deep blue)
- Shield: white (#ffffff)
- Graph line 1: #fbbf24 (yellow/gold)
- Graph line 2: #60a5fa (light blue)
- Text "DP": dark blue (#1d4ed8)

LAYOUT:
- Shield centered, occupying 70% of canvas
- Graph lines diagonal across shield (bottom-left to top-right)
- "DP" text positioned in upper portion of shield
- 10% padding around edges

OUTPUT:
- Square format (128x128 pixels)
- PNG with transparent edges (or solid blue circle)
- High resolution, crisp edges
- Suitable for VS Code Marketplace
```

---

## 🚀 SIMPLIFIED PROMPT (For Quick Generation)

```
Create a 128x128px VS Code extension icon with:
- Blue circular background (#1d4ed8)
- White shield symbol (security)
- Yellow and blue graph lines overlaid (cost analytics)
- Letters "DP" in the shield
- Flat design, minimal, professional
- High contrast, crisp edges
- Style similar to VS Code marketplace icons
```

---

## 🎯 ONE-LINE PROMPT (Ultra Simple)

```
Professional VS Code icon: blue circle, white shield, yellow graph lines, "DP" text, flat design, 128x128px
```

---

## 📱 GOOGLE AI STUDIO SPECIFIC PROMPT

If using Google AI Studio (Gemini):

```
Generate a square icon for a VS Code extension called "DevPulse" (API Security + LLM Cost Intelligence).

Requirements:
- Size: 128x128 pixels, square format
- Background: Solid blue circle (#1d4ed8)
- Main symbol: White shield (represents security/protection)
- Overlay: Graph/chart lines in yellow and blue (represents cost analytics)
- Branding: Letters "DP" inside shield
- Style: Flat design, no gradients, minimal, professional
- Design language: Similar to GitHub, Stripe, VS Code icons
- Contrast: High contrast for visibility at 16px size
- Output: PNG format with transparent or blue background

The icon should communicate "security" (shield) and "intelligence/analytics" (graph lines) at a glance.
```

---

## 🎨 MIDJOURNEY SPECIFIC PROMPT

If using Midjourney:

```
vs code extension icon, blue circular background, white shield symbol, yellow and blue ascending graph lines overlay, letters DP, flat design, minimal, professional, high contrast, 128x128 pixels, software icon style, no gradients --ar 1:1 --v 6 --style raw
```

---

## 🤖 DALL-E SPECIFIC PROMPT

If using DALL-E (ChatGPT):

```
Create a square icon (128x128 pixels) for a VS Code extension with these exact elements:

Background: Solid blue circle (#1d4ed8)
Foreground: White shield shape (security symbol)
Overlay: Two ascending graph lines - one yellow (#fbbf24), one light blue (#60a5fa)
Text: "DP" in bold sans-serif font, centered in shield
Style: Flat design, no shadows, no gradients, crisp edges
Aesthetic: Professional software icon like VS Code, GitHub, or Stripe icons
Visibility: High contrast for small sizes (16px to 128px)

Output as PNG, square format, transparent or blue background.
```

---

## 📋 DESIGN SPECIFICATIONS REFERENCE

Use these specs if the AI asks for more details:

**Dimensions:**
- Canvas: 128x128 pixels (square)
- Shield: ~90x100 pixels (centered)
- Graph lines: 2-3px stroke width
- Text "DP": 18-24px font size
- Padding: 8-10px from edges

**Colors (Hex Codes):**
- Blue background: `#1d4ed8`
- Shield: `#ffffff` (white)
- Graph line 1: `#fbbf24` (yellow/gold)
- Graph line 2: `#60a5fa` (light blue)
- DP text: `#1d4ed8` (dark blue)

**Typography:**
- Font: Sans-serif (Arial, Helvetica, or similar)
- Weight: Bold (700)
- Size: 18-24px
- Alignment: Center

**Design Style:**
- Flat design (Material Design style)
- No drop shadows
- No gradients
- No 3D effects
- Crisp, sharp edges
- High contrast

---

## 🛠️ ALTERNATIVE: CANVA PROMPT

If using Canva's AI (Magic Media):

```
VS Code extension icon with blue shield and graph lines, 128x128px, flat design, professional
```

Then manually adjust:
1. Set canvas to 128x128px
2. Use blue circle background (#1d4ed8)
3. Add white shield icon from elements
4. Add yellow/blue line chart overlay
5. Add "DP" text in bold

---

## 📊 WHAT THE AI SHOULD GENERATE

**Good result looks like:**
```
   ╔════════════════╗
   ║  ┌──────┐     ║  <- Blue circle background
   ║  │  DP  │     ║  <- White shield with "DP" text
   ║  │  ╱╲  │     ║  <- Yellow/blue graph lines
   ║  │ ╱  ╲ │     ║     ascending across shield
   ║  └──────┘     ║
   ╚════════════════╝
```

**Colors:**
- Background: Blue (#1d4ed8)
- Shield: White
- Graph: Yellow + Light Blue
- Text: Dark Blue

---

## 🎯 TESTING YOUR GENERATED ICON

After AI generates the icon:

1. **Check size:** Should be exactly 128x128 pixels
2. **Check format:** PNG with transparency or solid blue background
3. **Check visibility:** Icon should be clear at 16px size
4. **Check colors:** Match the hex codes above
5. **Check style:** Should look professional, not cartoonish

**Test visibility:**
- Resize to 16x16px (smallest size in VS Code)
- Shield and graph lines should still be visible
- Colors should have good contrast

---

## 💡 TIPS FOR BEST RESULTS

1. **Try multiple times:** Generate 3-4 variations, pick the best
2. **Specify "flat design":** Prevents 3D/gradient effects
3. **Mention "VS Code icon":** AI knows the style reference
4. **Request "high contrast":** Ensures visibility at small sizes
5. **Say "professional":** Avoids cartoonish results
6. **Provide hex colors:** Gets exact brand colors
7. **Specify PNG format:** Ensures correct file type

---

## 🚀 QUICK WORKFLOW

1. **Copy PRIMARY PROMPT** (most detailed version)
2. **Paste into Google AI Studio / Gemini**
3. **Generate image**
4. **Download as PNG**
5. **Rename to `icon.png`**
6. **Move to project root**
7. **Run:** `vsce package`
8. **PUBLISH!** 🎉

---

**Estimated time:** 2-5 minutes (depending on AI generation speed)

**No design skills needed!** Just copy/paste the prompt and let AI do the work.
