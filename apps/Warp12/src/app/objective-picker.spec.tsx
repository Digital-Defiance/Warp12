import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  GoOutCampaignField,
  MatchStarterPicker,
  defaultGoOutCampaignConfig,
  ObjectiveSummary,
} from './objective-picker.js';

describe('GoOutCampaignField', () => {
  it('shows overtime controls only for fixed-rounds', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <GoOutCampaignField
        name="test"
        value={defaultGoOutCampaignConfig(12)}
        onChange={onChange}
      />
    );
    expect(screen.queryByText('Tie-break overtime')).toBeNull();

    fireEvent.click(screen.getByDisplayValue('fixed-rounds'));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.goOutStructure).toBe('fixed-rounds');

    rerender(
      <GoOutCampaignField
        name="test"
        value={{
          ...defaultGoOutCampaignConfig(12),
          goOutStructure: 'fixed-rounds',
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Tie-break overtime')).toBeTruthy();
    expect(screen.getByLabelText('Campaign length')).toBeTruthy();
  });

  it('shows wins-to-win for first-to', () => {
    render(
      <GoOutCampaignField
        name="test"
        value={{
          ...defaultGoOutCampaignConfig(12),
          goOutStructure: 'first-to',
          goOutWinsToWin: 3,
        }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Wins to win')).toBeTruthy();
  });
});

describe('MatchStarterPicker', () => {
  it('lists every captain and reports index on change', () => {
    const onChange = vi.fn();
    render(
      <MatchStarterPicker
        captains={[
          { id: 'a', displayName: 'Armstrong' },
          { id: 'b', displayName: 'Lovell' },
        ]}
        value={-1}
        onChange={onChange}
      />
    );
    const select = screen.getByLabelText('First-round starter');
    fireEvent.change(select, { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith(1);
  });
});

describe('ObjectiveSummary', () => {
  it('summarizes go-out campaign structure for joiners', () => {
    render(
      <ObjectiveSummary
        objective="go-out"
        campaignRounds={5}
        goOutStructure="fixed-rounds"
      />
    );
    expect(screen.getByText(/Fixed rounds — 5 rounds/i)).toBeTruthy();
  });
});
