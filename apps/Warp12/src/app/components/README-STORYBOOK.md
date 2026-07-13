# TEI Rating Components - Storybook Documentation

This directory contains Storybook stories for the TEI rating display components.

## Components

### TeiDisplay
Shows complete TEI grade badges with letter grade (E/V/C/I/P) and score (0-99).
- **File:** `tei-display.tsx`
- **Story:** `tei-display.stories.tsx`
- **Props:** rating, currentGrade, objective, size

### TeiChange
Animates rating transitions after matches, highlights grade promotions.
- **File:** `tei-change.tsx`
- **Story:** `tei-change.stories.tsx`
- **Props:** beforeRating, beforeGrade, afterRating, afterGrade, showDelta, animate

### TeiGradeBadge
Compact grade indicator for in-game HUD display.
- **File:** `tei-grade-badge.tsx`
- **Story:** `tei-grade-badge.stories.tsx`
- **Props:** grade

## Setup Storybook

To use these stories, first set up Storybook in the Nx monorepo:

```bash
# Install Nx Storybook plugin
yarn add -D @nx/storybook

# Generate Storybook configuration for Warp12 app
yarn nx g @nx/storybook:configuration Warp12 --interactionTests=false --tsConfiguration=true

# Start Storybook
yarn nx storybook Warp12
```

## Running Stories

Once configured:

```bash
# Development mode
yarn nx storybook Warp12

# Build static Storybook
yarn nx build-storybook Warp12
```

## Story Files

All story files follow the pattern `*.stories.tsx` and are located alongside their components.

- `tei-display.stories.tsx` — All TEI grade variants, size options
- `tei-change.stories.tsx` — Rating transitions, promotions, animations
- `tei-grade-badge.stories.tsx` — Compact badges, all grades, in-context examples

## Documentation

Stories use `autodocs` tag for automatic documentation generation from props and JSDoc comments.
