import { render, screen } from '@testing-library/react';
import type { Route } from 'next';

import { finalButton, FlowFooter, primaryButton } from '@/ui/FlowFooter';
import { Stepper } from '@/ui/Stepper';

/** Redesign R3d: the flow chrome primitives. */
describe('Stepper', () => {
  it('marks the current step and says which are done', () => {
    render(
      <Stepper
        steps={['Choose the job', 'Pick keywords', 'Review']}
        step={1}
        label="Tailor steps"
      />,
    );
    const list = screen.getByRole('list', { name: 'Tailor steps' });
    expect(list).toBeInTheDocument();
    expect(screen.getByText('Pick keywords').closest('[aria-current]')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText(', done')).toBeInTheDocument();
  });
});

describe('Stepper links', () => {
  it('makes each done step a link back to it, and leaves the current and later ones plain', () => {
    render(
      <Stepper
        steps={['Job & Resume', 'Choose Keywords', 'Generate Results']}
        step={2}
        hrefs={['/a' as Route, '/b' as Route, '/c' as Route]}
      />,
    );
    expect(screen.getByRole('link', { name: /Job & Resume/ })).toHaveAttribute('href', '/a');
    expect(screen.getByRole('link', { name: /Choose Keywords/ })).toHaveAttribute('href', '/b');
    expect(screen.queryByRole('link', { name: /Generate Results/ })).toBeNull();
  });
});

describe('FlowFooter', () => {
  it('announces a danger note as an alert', () => {
    render(
      <FlowFooter note="Pick at least one keyword to continue." noteTone="danger">
        <button type="button">Continue</button>
      </FlowFooter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Pick at least one keyword to continue.');
  });

  it('gives the final commit the ink look, apart from the everyday primary', () => {
    expect(finalButton).toContain('bg-action-inverse');
    expect(primaryButton).toContain('bg-action-primary');
  });
});
