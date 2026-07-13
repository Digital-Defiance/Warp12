/**
 * Storybook stories for TeiGradeBadge component.
 * 
 * Compact grade indicators for in-game display.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { TeiGradeBadge } from './tei-grade-badge';

const meta: Meta<typeof TeiGradeBadge> = {
  component: TeiGradeBadge,
  title: 'Rating/TeiGradeBadge',
  tags: ['autodocs'],
  argTypes: {
    grade: {
      control: 'select',
      options: ['E', 'V', 'C', 'I', 'P'],
      description: 'TEI confidence grade',
    },
  },
};

export default meta;
type Story = StoryObj<typeof TeiGradeBadge>;

export const Elite: Story = {
  args: {
    grade: 'E',
  },
};

export const Veteran: Story = {
  args: {
    grade: 'V',
  },
};

export const Consistent: Story = {
  args: {
    grade: 'C',
  },
};

export const Improving: Story = {
  args: {
    grade: 'I',
  },
};

export const Provisional: Story = {
  args: {
    grade: 'P',
  },
};

export const AllGrades: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#1a1a1a', padding: '1rem' }}>
      <span style={{ color: '#fff' }}>Grades:</span>
      <TeiGradeBadge grade="E" />
      <TeiGradeBadge grade="V" />
      <TeiGradeBadge grade="C" />
      <TeiGradeBadge grade="I" />
      <TeiGradeBadge grade="P" />
    </div>
  ),
};

export const InContext: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column', background: '#1a1a1a', padding: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <TeiGradeBadge grade="V" />
        <span style={{ color: '#fff' }}>Captain Armstrong</span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <TeiGradeBadge grade="C" />
        <span style={{ color: '#fff' }}>Captain Lovell</span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <TeiGradeBadge grade="I" />
        <span style={{ color: '#fff' }}>Captain Earhart</span>
      </div>
    </div>
  ),
};
