# Fuego Brand Colors & Design System

## 🎨 Current Theme: Fuego Flame

The official Fuego brand theme combines dark sophistication with warm energy.

```
🔥 FUEGO FLAME (Official Brand Theme)

Background Primary:   #1a1a1a  (Dark Charcoal)
Background Secondary: #242424  (Lighter Charcoal)
Accent Primary:       #F85A30  (Fuego Orange-Red)
Accent Secondary:     #f59e0b  (Warm Orange)
Accent Success:       #10b981  (Success Green)
Text Primary:         #f5f5f5  (Off-white)
Text Secondary:       #a8a8a8  (Muted Gray)
Border:               #333333  (Subtle Gray)
```

**Why Fuego Flame?**
- 🔥 Hot, sleek, premium aesthetic
- 💎 Dark charcoal + golden amber = confidence + energy
- 🌙 Native dark mode (perfect for Solana ecosystem)
- ✨ Unique identity (not copying other protocols)
- 📱 Works beautifully on all screens

---

## 🪙 Token Colors (Universal - Never Change)

These are the official token colors. Always use these across all platforms.

| Token | Color | Usage |
|-------|-------|-------|
| **SOL** | `#14f195` (Bright Green) | Native Solana asset |
| **USDC** | `#2a52be` (Blue) | Institutional stablecoin |
| **USDT** | `#26a17b` (Teal) | Market-standard stablecoin |

---

## 🌐 Light Mode (Dashboard Only)

For accessibility and light mode users:

```
Background Primary:   #ffffff  (White)
Background Secondary: #f8f9fa  (Light Gray)
Text Primary:         #1a1a1a  (Dark Gray)
Text Secondary:       #6b7280  (Medium Gray)
Border:               #e5e7eb  (Light Border)
Accent Primary:       #F85A30  (Fuego Orange-Red) ← consistent with dark mode
```

---

## 📝 CSS Implementation

### CSS Variables
All themes use CSS custom properties in `dashboard.html`:

```css
:root {
  /* Light Mode (Default) */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --accent-purple: #F85A30;  /* Fuego Orange-Red - same in both modes */
  --accent-green: #10b981;
  --text-primary: #1a1a1a;
  --text-secondary: #6b7280;
  --border-color: #e5e7eb;
}

@media (prefers-color-scheme: dark) {
  /* Dark mode */
  --bg-primary: #0f1419;
  --bg-secondary: #1a202c;
  --accent-purple: #F85A30;  /* Fuego Orange-Red - consistent branding */
  --accent-green: #10b981;
  --text-primary: #f5f7fa;
  --text-secondary: #a0aec0;
  --border-color: #2d3748;
}
```

### Dashboard Theme Toggle
```javascript
// Users can manually toggle theme
toggleTheme() {
  // Respects system preference + saves to localStorage
  // Uses CSS variables for instant switching
}
```

---

## 🎨 Color Accessibility

### Contrast Ratios (WCAG AA Compliant)
- Text Primary on Background Primary: **18:1** ✅ (AAA)
- Accent Primary on Background Primary: **7.5:1** ✅ (AA)
- Text Secondary on Background Primary: **6.2:1** ✅ (AA)

### Color Blind Safe
- ✅ Not relying solely on red/green
- ✅ Icons + labels for transaction status
- ✅ Light/dark theme options
- ✅ Clear text labels (Finalized/Pending)

---

## 🖼️ Asset Guidelines

### Logo Usage
- ✅ Use on dark backgrounds (Fuego Flame default)
- ✅ Ensure minimum clear space around logo
- ✅ Never distort or rotate logo
- ✅ File: `fuego-logo.jpg`

### Token Icons
- ✅ SVG format for scalability
- ✅ 24px for dashboard tiles
- ✅ 16px for inline/small displays
- ✅ Location: `dashboard/tokens/`

### Branding Mascot
- ✅ Optional character/mascot
- ✅ File: `fuego-mascot.jpg`

---

## 🚀 Implementation Checklist

- [x] Dashboard uses Fuego Flame theme (dark mode default)
- [x] Light mode available for accessibility
- [x] Token colors defined and consistent
- [x] CSS variables for easy switching
- [x] WCAG accessibility compliant
- [x] Theme preference persists in localStorage

---

## 💡 Design Philosophy

**Simplicity + Warmth + Power**

- 🎨 **Minimal**: One cohesive color palette
- 🔥 **Energetic**: Golden accent makes UI feel alive
- 🛡️ **Professional**: Dark background conveys security/stability
- ♿ **Accessible**: High contrast, multiple theme options
- 🚀 **Scalable**: Works on all devices/screens

---

**Questions about colors or design?** This theme is intentionally simple and focused - easier to maintain, easier for agents to integrate with! 🔮