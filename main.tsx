import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('🚀 entry: main.tsx starting');

try {
  const rootElement = document.getElementById('root');
  console.log('🔍 entry: checking root element', rootElement ? 'found' : 'not found');
  
  if (!rootElement) {
    throw new Error('Elemento "root" não encontrado no index.html!');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  console.log('✅ entry: React render called successfully');
} catch (error) {
  console.error('❌ FATAL ERROR during mounting:', error);
  document.body.innerHTML = `
    <div style="padding: 20px; color: white; background: #991b1b; font-family: sans-serif;">
      <h1>Erro Fatal ao Carregar</h1>
      <pre>${error instanceof Error ? error.message : String(error)}</pre>
      <p>Verifique o console do desenvolvedor (F12) para detalhes.</p>
    </div>
  `;
}
