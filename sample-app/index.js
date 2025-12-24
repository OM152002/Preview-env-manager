const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Get environment info
const ENV_NAME = process.env.ENV_NAME || 'unknown';
const PR_NUMBER = process.env.PR_NUM || 'N/A';

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Preview Environment</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          padding: 30px;
          border-radius: 10px;
          backdrop-filter: blur(10px);
        }
        h1 { margin-top: 0; }
        .info { 
          background: rgba(255, 255, 255, 0.2);
          padding: 15px;
          border-radius: 5px;
          margin: 10px 0;
        }
        .success {
          background: rgba(72, 187, 120, 0.3);
          padding: 10px;
          border-radius: 5px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Preview Environment Manager</h1>
        <p>This is a sample application deployed in a preview environment!</p>
        
        <div class="info">
          <strong>Environment:</strong> ${ENV_NAME}
        </div>
        
        <div class="info">
          <strong>PR Number:</strong> ${PR_NUMBER}
        </div>
        
        <div class="info">
          <strong>Server Time:</strong> ${new Date().toISOString()}
        </div>
        
        <div class="success">
          Application is running successfully!
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    environment: ENV_NAME,
    pr: PR_NUMBER,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${ENV_NAME}`);
  console.log(`PR Number: ${PR_NUMBER}`);
});
