import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { RulesMarkdown } from './rules-markdown';

describe('RulesMarkdown', () => {
  it('renders level-2 headings from ## syntax', () => {
    render(
      <MemoryRouter>
        <RulesMarkdown source={'## Victory conditions\n\nBody text.'} />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Victory conditions' })
    ).toBeTruthy();
    expect(screen.getByText('Body text.')).toBeTruthy();
  });

  it('renders level-4 headings from #### syntax', () => {
    render(
      <MemoryRouter>
        <RulesMarkdown
          source={'#### Phase 2 — Learned value / policy (1–2 years)'}
        />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', {
        level: 4,
        name: 'Phase 2 — Learned value / policy (1–2 years)',
      })
    ).toBeTruthy();
  });

  it('renders fenced code blocks', () => {
    render(
      <MemoryRouter>
        <RulesMarkdown source={'```bash\nyarn calibrate:ai-tei\n```'} />
      </MemoryRouter>
    );

    expect(screen.getByText('yarn calibrate:ai-tei')).toBeTruthy();
  });

  it('maps internal doc links to in-app routes', () => {
    render(
      <MemoryRouter>
        <RulesMarkdown
          source={'See [calibration log](./calibration-log.md) for details.'}
        />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: 'calibration log' });
    expect(link.getAttribute('href')).toBe('/paper/log');
  });
});
