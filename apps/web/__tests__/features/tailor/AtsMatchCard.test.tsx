import { render, screen } from '@testing-library/react';

import { AtsMatchCard } from '@/features/tailor/flow/AtsMatchCard';

/** "ATS Match Score" on Enhance (owner's reference card, toreview §166). */
describe('AtsMatchCard', () => {
  it('shows the score, its band, and what the ticked keywords are estimated to add', () => {
    render(<AtsMatchCard score={67} gain={2.3} selected={5} />);
    expect(screen.getByRole('heading', { name: /ATS Match Score/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'ATS score: 6.7 out of 10' })).toBeInTheDocument();
    expect(screen.getByText('Fair')).toBeInTheDocument();
    expect(screen.getByText('+2.3 points (est.)')).toBeInTheDocument();
    expect(screen.getByText('If you add 5 selected keywords')).toBeInTheDocument();
  });

  it('claims no gain before anything is ticked', () => {
    render(<AtsMatchCard score={67} gain={0} selected={0} />);
    expect(screen.queryByText(/points \(est\.\)/)).toBeNull();
    expect(
      screen.getByText('Tick the keywords you have to see what they add.'),
    ).toBeInTheDocument();
  });
});
