import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { Logger } from './services/logger';
import { ErrorBoundary } from './components/ErrorBoundary';

Logger.init();

const rootElement = document.getElementById('root');
if (!rootElement) {
  Logger.error("Could not find root element to mount to");
  throw new Error("Could not find root element to mount to");
}

Logger.info("Mounting React Application");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);