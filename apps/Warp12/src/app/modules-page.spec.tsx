import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ModulesPage } from './modules-page';

describe('ModulesPage', () => {
  it('tells the module study story and spotlight modules', () => {
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /^modules$/i })).toBeTruthy();
    expect(screen.getByText(/285,?000/i)).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: /epsilon — why drafting is a party module/i,
      })
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: /zeta — crew nights and serious squads/i,
      })
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: /why we tore out elo for openskill/i,
      })
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: /full manual/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /how tei works/i })).toBeTruthy();
  });
});
