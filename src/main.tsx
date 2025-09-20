import React from 'react';
import ReactDOM from 'react-dom/client';
import { Authenticator } from '@aws-amplify/ui-react';
import App from './App.tsx';
import './index.css';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import '@aws-amplify/ui-react/styles.css';

// Configure the Amplify client library with the backend outputs
Amplify.configure(outputs);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* The Authenticator component wraps your App and handles the entire
        sign-in/sign-up/forgot-password UI flow. */}
    <Authenticator>
      <App />
    </Authenticator>
  </React.StrictMode>
);
