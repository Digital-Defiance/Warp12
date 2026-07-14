import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SquadronFormationPreview } from './squadron-formation-preview.js';
import type { FirestoreCaptain } from '../firebase';

function captain(id: string, displayName: string): FirestoreCaptain {
  return { id, displayName, pointsScore: 0, joinedAt: new Date().toISOString() };
}

const noopRosters = () => {};

describe('SquadronFormationPreview', () => {
  it('renders chips for auto-formed squads', () => {
    render(
      <SquadronFormationPreview
        captains={[
          captain('a', 'Alice'),
          captain('b', 'Bob'),
          captain('c', 'Carol'),
          captain('d', 'Dave'),
        ]}
        squadronSize={2}
        onSquadronSizeChange={() => {}}
        onSquadronNamesChange={() => {}}
        onSquadronRostersChange={noopRosters}
      />
    );
    expect(screen.getByPlaceholderText('Squad 1')).toBeTruthy();
    expect(screen.getByPlaceholderText('Squad 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Captain Alice' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Captain Carol' })).toBeTruthy();
  });

  it('shows an error instead of squads when the roster is too small', () => {
    render(
      <SquadronFormationPreview
        captains={[captain('a', 'Alice'), captain('b', 'Bob')]}
        squadronSize={3}
        onSquadronSizeChange={() => {}}
        onSquadronNamesChange={() => {}}
        onSquadronRostersChange={noopRosters}
      />
    );
    expect(screen.getByText(/Need at least 6 captains/)).toBeTruthy();
    expect(screen.queryByPlaceholderText('Squad 1')).toBeNull();
  });

  it('shows an error when the roster does not divide evenly', () => {
    render(
      <SquadronFormationPreview
        captains={[
          captain('a', 'Alice'),
          captain('b', 'Bob'),
          captain('c', 'Carol'),
          captain('d', 'Dave'),
          captain('e', 'Eve'),
        ]}
        squadronSize={2}
        onSquadronSizeChange={() => {}}
        onSquadronNamesChange={() => {}}
        onSquadronRostersChange={noopRosters}
      />
    );
    expect(screen.getByText(/does not divide evenly/)).toBeTruthy();
  });

  it('seeds squadronRosters via reconcile when none are stored', () => {
    const onSquadronRostersChange = vi.fn();
    render(
      <SquadronFormationPreview
        captains={[
          captain('a', 'Alice'),
          captain('b', 'Bob'),
          captain('c', 'Carol'),
          captain('d', 'Dave'),
        ]}
        squadronSize={2}
        onSquadronSizeChange={() => {}}
        onSquadronNamesChange={() => {}}
        onSquadronRostersChange={onSquadronRostersChange}
      />
    );
    expect(onSquadronRostersChange).toHaveBeenCalledWith([
      ['a', 'c'],
      ['b', 'd'],
    ]);
  });

  it('swaps captains on drop', () => {
    const onSquadronRostersChange = vi.fn();
    render(
      <SquadronFormationPreview
        captains={[
          captain('a', 'Alice'),
          captain('b', 'Bob'),
          captain('c', 'Carol'),
          captain('d', 'Dave'),
        ]}
        squadronSize={2}
        squadronRosters={[
          ['a', 'c'],
          ['b', 'd'],
        ]}
        onSquadronSizeChange={() => {}}
        onSquadronNamesChange={() => {}}
        onSquadronRostersChange={onSquadronRostersChange}
      />
    );
    const alice = screen.getByRole('button', { name: 'Captain Alice' });
    const bob = screen.getByRole('button', { name: 'Captain Bob' });
    fireEvent.dragStart(alice);
    fireEvent.drop(bob);
    expect(onSquadronRostersChange).toHaveBeenCalledWith([
      ['b', 'c'],
      ['a', 'd'],
    ]);
  });

  describe('squad naming', () => {
    const fourCaptains = [
      captain('a', 'Alice'),
      captain('b', 'Bob'),
      captain('c', 'Carol'),
      captain('d', 'Dave'),
    ];

    it('shows host-chosen names as input values', () => {
      render(
        <SquadronFormationPreview
          captains={fourCaptains}
          squadronSize={2}
          squadronNames={['Away Team', 'Home Team']}
          squadronRosters={[
            ['a', 'c'],
            ['b', 'd'],
          ]}
          onSquadronSizeChange={() => {}}
          onSquadronNamesChange={() => {}}
          onSquadronRostersChange={noopRosters}
        />
      );
      expect(screen.getByDisplayValue('Away Team')).toBeTruthy();
      expect(screen.getByDisplayValue('Home Team')).toBeTruthy();
    });

    it('calls onSquadronNamesChange with the full names array on edit', () => {
      const onSquadronNamesChange = vi.fn();
      render(
        <SquadronFormationPreview
          captains={fourCaptains}
          squadronSize={2}
          squadronNames={['Away Team']}
          squadronRosters={[
            ['a', 'c'],
            ['b', 'd'],
          ]}
          onSquadronSizeChange={() => {}}
          onSquadronNamesChange={onSquadronNamesChange}
          onSquadronRostersChange={noopRosters}
        />
      );
      const squad2Input = screen.getByPlaceholderText('Squad 2');
      fireEvent.change(squad2Input, { target: { value: 'Home Team' } });
      expect(onSquadronNamesChange).toHaveBeenCalledWith(['Away Team', 'Home Team']);
    });
  });

  describe('shared trail layout preview', () => {
    it('renders one diagram node per squadmate, one per squad', () => {
      render(
        <SquadronFormationPreview
          captains={[
            captain('a', 'Alice'),
            captain('b', 'Bob'),
            captain('c', 'Carol'),
            captain('d', 'Dave'),
          ]}
          squadronSize={2}
          squadronRosters={[
            ['a', 'c'],
            ['b', 'd'],
          ]}
          onSquadronSizeChange={() => {}}
          onSquadronNamesChange={() => {}}
          onSquadronRostersChange={noopRosters}
        />
      );
      const diagrams = screen.getAllByRole('img', { name: /share one warp trail/ });
      expect(diagrams).toHaveLength(2);
      expect(diagrams[0].querySelectorAll('span[title]')).toHaveLength(2);
    });
  });
});
