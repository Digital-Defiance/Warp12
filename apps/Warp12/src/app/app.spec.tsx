import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import App from './app';

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(baseElement).toBeTruthy();
  });

  it('should show the home bridge options', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: /rules/i })).toBeTruthy();
    expect(screen.getByText(/local simulation/i)).toBeTruthy();
    expect(screen.getByText(/online fleet/i)).toBeTruthy();
    expect(screen.getByText(/navigational operations manual/i)).toBeTruthy();
    expect(screen.getByText(/before you launch/i)).toBeTruthy();
    expect(screen.getByText(/tablet or desktop recommended/i)).toBeTruthy();
  });
});
