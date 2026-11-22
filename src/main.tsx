import { createRoot } from 'react-dom/client';
import App from './App';
import { OutputApp } from './output/OutputApp';
import { installAutosave } from './store';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root non trovata');

const isOutput = new URLSearchParams(window.location.search).has('output');
if (!isOutput) installAutosave();

createRoot(rootElement).render(isOutput ? <OutputApp /> : <App />);
