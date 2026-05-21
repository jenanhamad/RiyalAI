/** Same-origin in production; localhost:8000 in dev */
export function getApiBase() {
  if (process.env.REACT_APP_API_URL !== undefined && process.env.REACT_APP_API_URL !== '') {
    return process.env.REACT_APP_API_URL;
  }
  if (process.env.NODE_ENV === 'production') {
    return '';
  }
  return 'http://localhost:8000';
}
