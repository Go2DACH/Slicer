import React from 'react';
import ReactDOM from 'react-dom/client';
import { installBVH } from './lib/bvh';
import App from './App';
import './styles.css';

// Patch three.js to use BVH-accelerated raycasting everywhere.
installBVH();

// Expose the store for debugging / automated smoke tests.
import { useStore } from './store';
(window as unknown as { slicerStore: typeof useStore }).slicerStore = useStore;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
