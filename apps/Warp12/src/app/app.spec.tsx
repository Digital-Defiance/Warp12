import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import App from './app';

describe('App', () => {
  beforeEach(() => {
    localStorage.setItem('warp-factor', '12');
  });

  afterEach(() => {
    localStorage.removeItem('warp-factor');
  });

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
    expect(screen.getByRole('link', { name: 'Manual' })).toBeTruthy();
    expect(screen.getByText(/local simulation/i)).toBeTruthy();
    expect(screen.getByText(/online fleet/i)).toBeTruthy();
    expect(screen.getByText(/navigational operations manual/i)).toBeTruthy();
    expect(screen.getByText(/before you launch/i)).toBeTruthy();
    expect(screen.getByText(/hobby project/i)).toBeTruthy();
  });
});
