import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import "./premium-sevasetu-ui.css";
import "./sevasetuMongoSync.js";
import GlobalLanguageBridge from "./i18n/GlobalLanguageBridge.jsx";

createRoot(document.getElementById('root')).render(<App/>);