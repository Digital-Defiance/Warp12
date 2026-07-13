import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { TeiPage } from './tei-page';

describe('TeiPage', () => {
  it('explains TEI for captains and OpenSkill for the curious', () => {
    render(
      <MemoryRouter>
        <TeiPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /how tei works/i })).toBeTruthy();
    expect(screen.getByText(/you do not need openskill/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /for the curious — openskill/i })).toBeTruthy();
    expect(screen.getByText(/μ \(mu\)/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /back to profile/i })).toBeTruthy();
  });
});
