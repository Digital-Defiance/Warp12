import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { PaperPage } from './paper-page';

describe('PaperPage', () => {
  it('renders the research outline at /paper', () => {
    render(
      <MemoryRouter initialEntries={['/paper']}>
        <PaperPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /tei & engine research/i })).toBeTruthy();
    expect(screen.getByText(/self-play calibration of heuristic agents/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /calibration log/i })).toBeTruthy();
  });

  it('renders the calibration log at /paper/log', () => {
    render(
      <MemoryRouter initialEntries={['/paper/log']}>
        <PaperPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/TEI calibration log/i)).toBeTruthy();
    expect(screen.getByText(/AI_OPTIMIZER_GAMES=1000/i)).toBeTruthy();
  });
});
