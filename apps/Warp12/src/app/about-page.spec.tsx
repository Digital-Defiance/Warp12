import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AboutPage } from './about-page';

describe('AboutPage', () => {
  it('states tournament limitations and engine claim', () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/best mexican train engine in the galaxy that is currently known/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/do not use warp 12 to settle sanctioned tournament disputes/i)
    ).toBeTruthy();
    expect(screen.getByText(/tactical effectiveness index \(tei\)/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /back to the bridge/i })).toBeTruthy();
  });
});
