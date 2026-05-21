import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Riyal login screen', () => {
  render(<App />);
  expect(screen.getByText(/ريـال/i)).toBeInTheDocument();
  expect(screen.getByText(/مالك، في يدك/i)).toBeInTheDocument();
});
