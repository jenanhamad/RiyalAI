import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Riyali login screen', () => {
  render(<App />);
  expect(screen.getByText(/ريالي/i)).toBeInTheDocument();
  expect(screen.getByText(/مالك، في يدك/i)).toBeInTheDocument();
});
