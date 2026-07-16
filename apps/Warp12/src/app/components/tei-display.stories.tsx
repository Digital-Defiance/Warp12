/**
 * Storybook stories for TeiDisplay component.
 * 
 * To use: Install and configure Storybook with `yarn add -D @nx/storybook` and
 * `yarn nx g @nx/storybook:configuration Warp12`
 */

import type { Meta, StoryObj } from '@storybook/react';
import { TeiDisplay } from './tei-display';
import type { PlayerRating } from 'warp12-engine';

const meta: Meta<typeof TeiDisplay> = {
  component: TeiDisplay,
  title: 'Rating/TeiDisplay',
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
      description: 'Size variant for the badge',
    },
    objective: {
      control: 'select',
      options: ['go-out', 'points'],
      description: 'Game objective (affects display text)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof TeiDisplay>;

// Elite grade (σ < 0.5)
const eliteRating: PlayerRating = {
  mu: 45.0,
  sigma: 0.4,
  matches: 500,
};

// Veteran grade (0.5 ≤ σ < 1.5)
const veteranRating: PlayerRating = {
  mu: 35.0,
  sigma: 1.2,
  matches: 150,
};

// Consistent grade (1.5 ≤ σ < 2.5)
const consistentRating: PlayerRating = {
  mu: 28.0,
  sigma: 2.0,
  matches: 50,
};

// Improving grade (2.5 ≤ σ < 4.0)
const improvingRating: PlayerRating = {
  mu: 25.0,
  sigma: 3.0,
  matches: 10,
};

// Provisional grade (σ ≥ 4.0)
const provisionalRating: PlayerRating = {
  mu: 25.0,
  sigma: 8.33,
  matches: 0,
};

export const Elite: Story = {
  args: {
    rating: eliteRating,
    currentGrade: 'E',
    objective: 'points',
    size: 'medium',
  },
};

export const Veteran: Story = {
  args: {
    rating: veteranRating,
    currentGrade: 'V',
    objective: 'points',
    size: 'medium',
  },
};

export const Consistent: Story = {
  args: {
    rating: consistentRating,
    currentGrade: 'C',
    objective: 'goOut',
    size: 'medium',
  },
};

export const Improving: Story = {
  args: {
    rating: improvingRating,
    currentGrade: 'I',
    objective: 'points',
    size: 'medium',
  },
};

export const Provisional: Story = {
  args: {
    rating: provisionalRating,
    currentGrade: undefined,
    objective: 'points',
    size: 'medium',
  },
};

export const SmallSize: Story = {
  args: {
    rating: veteranRating,
    currentGrade: 'V',
    objective: 'points',
    size: 'small',
  },
};

export const LargeSize: Story = {
  args: {
    rating: veteranRating,
    currentGrade: 'V',
    objective: 'points',
    size: 'large',
  },
};

export const AllGrades: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
      <TeiDisplay rating={eliteRating} currentGrade="E" objective="points" size="medium" />
      <TeiDisplay rating={veteranRating} currentGrade="V" objective="points" size="medium" />
      <TeiDisplay rating={consistentRating} currentGrade="C" objective="points" size="medium" />
      <TeiDisplay rating={improvingRating} currentGrade="I" objective="points" size="medium" />
      <TeiDisplay rating={provisionalRating} currentGrade={undefined} objective="points" size="medium" />
    </div>
  ),
};
