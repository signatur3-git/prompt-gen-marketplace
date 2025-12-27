# Theme System - Quick Start Guide

## For Users

### How to Switch Themes

Look for the theme switcher in the **top-right corner** of the navigation bar:

- **🔄 Auto**: Follows your OS theme (Windows/Mac/Linux dark mode setting)
- **☀️ Light**: Always use light mode
- **🌙 Dark**: Always use dark mode

Your preference is saved automatically and will persist across browser sessions.

## For Developers

### Quick Reference

#### Using Themed Colors

Replace hardcoded colors with CSS custom properties:

```css
/* Before */
.my-component {
  background: #ffffff;
  color: #333;
}

/* After */
.my-component {
  background: var(--bg-primary);
  color: var(--text-primary);
}
```

#### Available CSS Variables

**Backgrounds:**
- `--bg-primary` - Main background (cards, modals)
- `--bg-secondary` - Page background
- `--bg-tertiary` - Subtle background variations
- `--bg-hover` - Hover states
- `--bg-code` - Code blocks

**Text:**
- `--text-primary` - Main text
- `--text-secondary` - Secondary text
- `--text-muted` - Disabled/muted text

**Borders:**
- `--border-color` - Default borders
- `--border-light` - Light border variant

**Colors:**
- `--accent-color` - Links, primary actions (blue)
- `--accent-hover` - Hover state for accent
- `--secondary-color` - Secondary buttons (gray)
- `--secondary-hover` - Hover state for secondary
- `--danger-color` - Delete, errors (red)
- `--danger-hover` - Hover state for danger
- `--success-bg/border/text` - Success messages
- `--warning-bg/border/text` - Warning messages
- `--error-bg/border/text` - Error messages
- `--info-bg/border/text` - Info messages

**Effects:**
- `--shadow-sm` - Small shadows
- `--shadow-md` - Medium shadows
- `--modal-overlay` - Modal backdrop

### Testing Your Changes

1. **Type Check**: `npm run type-check`
2. **Build**: `npm run build`
3. **Manual Testing**:
   - Switch between all three theme modes
   - Check your component in both light and dark
   - Verify colors are readable and accessible

### Preview Theme System

Open `docs/theme-preview.html` in your browser to see a standalone preview of the themed components.

## Common Patterns

### Buttons
```css
.my-button {
  background: var(--accent-color);
  color: white;
}
.my-button:hover {
  background: var(--accent-hover);
}
```

### Cards/Panels
```css
.my-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 4px var(--shadow-sm);
}
```

### Form Inputs
```css
input {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}
```

### Inline Code
```css
code {
  background: var(--bg-code);
  color: var(--text-primary);
}
```

## Files to Know

- `frontend/src/composables/useTheme.ts` - Theme management logic
- `frontend/src/components/ThemeSwitcher.vue` - Theme UI component
- `frontend/src/style.css` - CSS custom properties definitions
- `docs/THEME_SYSTEM.md` - Full documentation

## Need Help?

See `docs/THEME_SYSTEM.md` for complete documentation including:
- Architecture details
- How to add new themed colors
- Browser compatibility
- Future enhancements

