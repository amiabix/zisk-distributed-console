import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

(async () => {
  let App;
  try {
    const appModule = await import('./App');
    App = appModule.default;
  } catch (error) {
    console.error('Failed to import App:', error);
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: monospace; background: #faf9f6; color: #2d2926;">
        <h1 style="color: red;">Module Import Error</h1>
        <p>Failed to load the application. This is likely due to a browser extension blocking resources.</p>
        <p><strong>Error:</strong> ${error instanceof Error ? error.message : String(error)}</p>
        <p><strong>Solution:</strong> Disable ad blockers/privacy extensions for localhost:5173</p>
        <p><strong>Details:</strong> Check console for more information.</p>
      </div>
    `;
    return;
  }

  function initApp() {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      console.error('Failed to find root element');
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'padding: 20px; color: red; font-family: monospace; background: #faf9f6;';
      errorDiv.innerHTML = '<h1>Error: Root element not found</h1><p>The #root div is missing from index.html</p>';
      document.body.appendChild(errorDiv);
      return;
    }

    rootElement.innerHTML = '<div style="padding: 20px; font-family: monospace; color: #2d2926;">Loading React app...</div>';

    try {
      createRoot(rootElement).render(
        <StrictMode>
          <App />
        </StrictMode>
      );
    } catch (error) {
      console.error('Error rendering app:', error);
      const errorHtml = `
        <div style="padding: 20px; font-family: monospace; background: #faf9f6; color: #2d2926;">
          <h1 style="color: red;">React Error</h1>
          <pre style="background: white; padding: 10px; border-radius: 4px; overflow: auto;">${error instanceof Error ? error.message : String(error)}</pre>
          ${error instanceof Error && error.stack ? `<pre style="background: white; padding: 10px; border-radius: 4px; font-size: 12px; overflow: auto;">${error.stack}</pre>` : ''}
        </div>
      `;
      rootElement.innerHTML = errorHtml;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initApp();
    });
  } else {
    initApp();
  }
})();
