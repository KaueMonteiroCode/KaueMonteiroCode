import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OfficeApp } from './OfficeApp';
import '../styles.css';
import './office.css';

createRoot(document.getElementById('root')!).render(<StrictMode><OfficeApp /></StrictMode>);
