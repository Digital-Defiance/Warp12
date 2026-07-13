/**
 * Storybook stories for TeiChange component.
 * 
 * Shows rating transitions with animations and grade changes.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { TeiChange } from './tei-change';
import type { PlayerRating } from 'warp12-engine';

const meta: Meta<typeof TeiChange> = {
  component: TeiChange,
  title: 'Rating/TeiChange',
  tags: ['autodocs'],
  argTypes: {
    showDelta: {
      control: 'boolean',
      description: 'Show μ delta value',
    },
    animate: {
      control: 'boolean',
      description: 'Enable animation effects',
    },
  },
};

export default meta;
type Story = StoryObj<typeof TeiChange>;

const beforeRating: PlayerRating = { mu: 28.0, sigma: 2.5, matches: 15 };
const afterRatingImproved: PlayerRating = { mu: 30.2, sigma: 2.4, matches: 16 };
const afterRatingDecreased: PlayerRating = { mu: 26.5, sigma: 2.6, matches: 16 };

const beforePromo: PlayerRating = { mu: 28.0, sigma: 2.6, matches: 15 };
const afterPromo: PlayerRating = { mu: 30.2, sigma: 2.4, matches: 16 };

export const RatingIncrease: Story = {
  args: {
    beforeRating,
    beforeGrade: 'I',
    afterRating: afterRatingImproved,
    afterGrade: 'I',
    showDelta: true,
    animate: true,
  },
};

export const RatingDecrease: Story = {
  args: {
    beforeRating,
    beforeGrade: 'I',
    afterRating: afterRatingDecreased,
    afterGrade: 'I',
    showDelta: true,
    animate: true,
  },
};

export const GradePromotion: Story = {
  args: {
    beforeRating: beforePromo,
    beforeGrade: 'I',
    afterRating: afterPromo,
    afterGrade: 'C',
    showDelta: true,
    animate: true,
  },
};

export const LargeImprovement: Story = {
  args: {
    beforeRating: { mu: 25.0, sigma: 4.0, matches: 5 },
    beforeGrade: 'P',
    afterRating: { mu: 32.0, sigma: 2.8, matches: 6 },
    afterGrade: 'I',
    showDelta: true,
    animate: true,
  },
};

export const NoDelta: Story = {
  args: {
    beforeRating,
    beforeGrade: 'I',
    afterRating: afterRatingImproved,
    afterGrade: 'I',
    showDelta: false,
    animate: true,
  },
};

export const NoAnimation: Story = {
  args: {
    beforeRating,
    beforeGrade: 'I',
    afterRating: afterRatingImproved,
    afterGrade: 'I',
    showDelta: true,
    animate: false,
  },
};
