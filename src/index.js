import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import Application from './Application';

// AWS CONFIG
import Amplify from 'aws-amplify';
import config from './aws-exports';
// Link to the backend from the FE
Amplify.configure(config);

ReactDOM.render(<Application />, document.getElementById('root'));
