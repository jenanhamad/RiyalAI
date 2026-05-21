import { render, screen } from '@testing-library/react';
import App from './App';

test('renders RiyalAI landing page', () => {
  render(<App />);
  expect(screen.getByText(/RiyalAI/i)).toBeInTheDocument();
});
