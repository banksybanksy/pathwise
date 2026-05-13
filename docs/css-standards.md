# Pathwise — CSS Design Standards
_Frontend reference for Team 2. Keep this consistent across all components._

---

## Colors

Define these as CSS variables in a single `variables.css` file and import it everywhere.

```css
:root {
  --color-primary: #4F46E5;      /* main brand color, buttons, links */
  --color-primary-hover: #4338CA;
  --color-secondary: #6B7280;    /* secondary text, labels */
  --color-background: #F9FAFB;   /* page background */
  --color-surface: #FFFFFF;      /* cards, panels */
  --color-border: #E5E7EB;       /* dividers, input borders */
  --color-text: #111827;         /* main body text */
  --color-text-muted: #6B7280;   /* captions, hints */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
}
```

---

## Typography

```css
:root {
  --font-family: 'Inter', sans-serif;

  --font-size-sm: 0.875rem;   /* 14px — captions, labels */
  --font-size-base: 1rem;     /* 16px — body text */
  --font-size-md: 1.125rem;   /* 18px — subheadings */
  --font-size-lg: 1.5rem;     /* 24px — section headings */
  --font-size-xl: 2rem;       /* 32px — page titles */

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;

  --line-height: 1.6;
}
```

Use Inter from Google Fonts — add this to the `<head>` of every page:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
```

---

## Spacing

Stick to multiples of 4px so spacing stays consistent.

```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
}
```

---

## Breakpoints

We only need two for now — mobile and desktop. Add tablet later if needed.

```css
/* Mobile first — base styles apply to mobile */
/* Desktop */
@media (min-width: 1024px) { ... }
```

---

## Base Components

### Buttons

```css
.btn {
  padding: var(--space-sm) var(--space-md);
  border-radius: 6px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  border: none;
}

.btn-primary {
  background-color: var(--color-primary);
  color: #fff;
}

.btn-primary:hover {
  background-color: var(--color-primary-hover);
}

.btn-secondary {
  background-color: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}
```

### Input Fields

```css
.input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: var(--font-size-base);
  color: var(--color-text);
  background-color: var(--color-surface);
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
}
```

### Cards

```css
.card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: var(--space-lg);
}
```

---

## Class Naming Convention

Use simple, descriptive names. No need for strict BEM — just be consistent.

- Layout: `.page-wrapper`, `.sidebar`, `.main-content`
- Components: `.card`, `.btn`, `.input`, `.navbar`, `.modal`
- Modifiers: `.btn-primary`, `.btn-secondary`, `.card-active`
- State: `.is-hidden`, `.is-loading`, `.is-active`

Avoid generic names like `.box`, `.container2`, `.div-thing`.

---

## File Structure

```
/public
  /css
    variables.css      ← all CSS variables go here
    base.css           ← resets, body, typography
    components.css     ← buttons, inputs, cards
    layout.css         ← navbar, sidebar, page structure
    pages/
      dashboard.css
      search.css
      etc.
```

Import order in your HTML:
```html
<link rel="stylesheet" href="/css/variables.css">
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/components.css">
<link rel="stylesheet" href="/css/layout.css">
<link rel="stylesheet" href="/css/pages/dashboard.css">
```

---

## Notes

- Don't hardcode hex values anywhere — always use the CSS variables.
- Don't use inline styles.
- Keep page-specific styles in their own file under `/pages/`.
- The mandatory header banner ("SFSU Software Engineering Project CSC 648-848, Spring 2026. For Demonstration Only") goes in `base.css` as a fixed top bar so it appears on every page automatically.
