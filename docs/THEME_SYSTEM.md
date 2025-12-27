# Theme System Documentation

## Overview

The Prompt Gen Marketplace now supports light/dark mode theming with automatic OS detection. Users can choose between three modes:

- **🔄 Auto**: Automatically follows the operating system's theme preference
- **☀️ Light**: Forces light mode regardless of OS settings
- **🌙 Dark**: Forces dark mode regardless of OS settings

## Features

- **Automatic OS Detection**: Uses CSS `prefers-color-scheme` media query
- **Manual Override**: Users can manually select their preferred theme
- **Persistent Preferences**: Theme choice is saved to localStorage
- **Smooth Transitions**: All color changes animate smoothly
- **Comprehensive Coverage**: All UI elements are themed consistently

## Implementation Details

### Files Added

1. **`frontend/src/composables/useTheme.ts`**
   - Vue composable for theme management
   - Handles theme switching and localStorage persistence
   - Provides reactive theme state

2. **`frontend/src/components/ThemeSwitcher.vue`**
   - UI component for the theme switcher
   - Three-button toggle in the navigation bar
   - Visual indication of active theme

### Files Modified

1. **`frontend/src/style.css`**
   - Added CSS custom properties (CSS variables) for theming
   - Defined color schemes for both light and dark modes
   - Updated all component styles to use CSS variables

2. **`frontend/src/App.vue`**
   - Added ThemeSwitcher component to navigation bar
   - Imported theme component

3. **`frontend/src/main.ts`**
   - Initialize theme before app mounts to prevent flash of wrong theme

## CSS Custom Properties

The following CSS variables are defined for theming:

### Background Colors
- `--bg-primary`: Primary background (white/dark gray)
- `--bg-secondary`: Secondary background (light gray/darker gray)
- `--bg-tertiary`: Tertiary background
- `--bg-hover`: Hover state background
- `--bg-code`: Code block background

### Text Colors
- `--text-primary`: Primary text color
- `--text-secondary`: Secondary text color
- `--text-muted`: Muted/disabled text

### Border Colors
- `--border-color`: Default border color
- `--border-light`: Light border variant

### Accent Colors
- `--accent-color`: Primary accent/link color (blue)
- `--accent-hover`: Accent hover state

### Semantic Colors
- `--danger-color`: Danger/error color (red)
- `--danger-hover`: Danger hover state
- `--warning-bg/border/text`: Warning message colors
- `--error-bg/border/text`: Error message colors

### Effects
- `--shadow-sm`: Small shadow
- `--shadow-md`: Medium shadow
- `--modal-overlay`: Modal overlay background

## Usage in Components

When creating new components or modifying existing ones, use CSS custom properties instead of hardcoded colors:

```css
/* ❌ Don't do this */
.my-component {
  background: #ffffff;
  color: #333333;
  border: 1px solid #dddddd;
}

/* ✅ Do this instead */
.my-component {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}
```

## Adding New Themed Colors

If you need to add new themed colors:

1. Define the variable in all three places in `style.css`:
   - `:root` (default light mode)
   - `@media (prefers-color-scheme: dark)` (auto dark mode)
   - `[data-theme='light']` and `[data-theme='dark']` (manual overrides)

2. Example:
```css
:root {
  --my-new-color: #007bff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --my-new-color: #4493f8;
  }
}

[data-theme='light'] {
  --my-new-color: #007bff;
}

[data-theme='dark'] {
  --my-new-color: #4493f8;
}
```

## Browser Support

The theme system uses modern CSS features:
- CSS Custom Properties (CSS Variables)
- `prefers-color-scheme` media query
- localStorage API

All modern browsers support these features. For legacy browser support, the app will default to light mode.

## Testing

To test the theme system:

1. **Auto Mode**:
   - Change your OS theme settings
   - The app should automatically switch themes

2. **Manual Modes**:
   - Click the theme buttons in the navigation
   - Theme should persist across page reloads

3. **Multiple Tabs**:
   - Open multiple tabs
   - Changing theme in one tab may require manual refresh in others (localStorage doesn't sync automatically)

## Future Enhancements

Potential improvements:
- Add more color schemes (e.g., high contrast, colorblind-friendly)
- System tray/notification when theme changes
- Smooth theme transition animations
- Per-page theme customization

