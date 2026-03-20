import React from 'react';
import { createRoot } from 'react-dom/client';

import AlwaysOnTop from './AlwaysOnTop';

// Render the main/root Component.
const rootElement = document.getElementById('react');
const alwaysOnTopRoot = rootElement ? createRoot(rootElement) : null;

alwaysOnTopRoot?.render(<AlwaysOnTop />);

window.addEventListener('beforeunload', () => alwaysOnTopRoot?.unmount());
