import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByText(/530,?000/i)).toBeTruthy();
    expect(screen.getAllByText(/274,?500/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/255,?500/i).length).toBeGreaterThan(0);
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

  it('switches the skill table between points and go-out instruments', () => {
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('tab', { name: /points campaign/i }).getAttribute(
        'aria-selected'
      )
    ).toBe('true');
    expect(screen.getAllByText('1.08/4').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: /^go-out$/i }));

    expect(
      screen.getByRole('tab', { name: /^go-out$/i }).getAttribute(
        'aria-selected'
      )
    ).toBe('true');
    expect(screen.getAllByText(/unavailable/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Salamander Surge').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2.97/4').length).toBeGreaterThan(0);
  });
});
