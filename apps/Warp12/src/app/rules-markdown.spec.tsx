import { render, screen } from '@testing-library/react';

import { RulesMarkdown } from './rules-markdown';

describe('RulesMarkdown', () => {
  it('renders level-2 headings from ## syntax', () => {
    render(<RulesMarkdown source={'## Victory conditions\n\nBody text.'} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Victory conditions' })
    ).toBeTruthy();
    expect(screen.getByText('Body text.')).toBeTruthy();
  });
});
