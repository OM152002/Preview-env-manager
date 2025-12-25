const express = require('express');
const { Webhooks } = require('@octokit/webhooks');
const bodyParser = require('body-parser');
const { execSync } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// GitHub webhook secret (for now, we'll use a simple secret)
const WEBHOOK_SECRET = 'development-secret-123';

// Initialize webhooks
const webhooks = new Webhooks({
  secret: WEBHOOK_SECRET,
});

// Middleware
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Preview Environment Manager - Webhook Server</title>
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
        .status {
          background: rgba(72, 187, 120, 0.3);
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
        code {
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 6px;
          border-radius: 3px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Webhook Server Running</h1>
        <div class="status">
          Server is active and listening for GitHub webhooks
        </div>
        <p><strong>Webhook endpoint:</strong> <code>POST /webhook</code></p>
        <p><strong>Health check:</strong> <code>GET /health</code></p>
      </div>
    </body>
    </html>
  `);
});

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];

  console.log(`Received ${event} event`);

  try {
    // Verify webhook signature
    await webhooks.verifyAndReceive({
      id: req.headers['x-github-delivery'],
      name: event,
      signature: signature,
      payload: req.rawBody.toString(),
    });

    res.status(200).json({ message: 'Webhook received successfully' });
  } catch (error) {
    console.error('Webhook verification failed:', error.message);
    res.status(400).json({ error: 'Webhook verification failed' });
  }
});

// Handle pull_request.opened event
webhooks.on('pull_request.opened', async ({ payload }) => {
  const prNumber = payload.pull_request.number;
  const repoName = payload.repository.name;

  console.log(`\nPR #${prNumber} opened in ${repoName}`);
  console.log(`Title: ${payload.pull_request.title}`);
  console.log(`Author: ${payload.pull_request.user.login}`);

  try {
    // Deploy preview environment
    await deployPreviewEnvironment(prNumber);
    console.log(`Preview environment deployed for PR #${prNumber}`);
  } catch (error) {
    console.error(`Failed to deploy preview environment:`, error.message);
  }
});

// Handle pull_request.synchronize event (new commits pushed)
webhooks.on('pull_request.synchronize', async ({ payload }) => {
  const prNumber = payload.pull_request.number;
  const repoName = payload.repository.name;

  console.log(`\nPR #${prNumber} updated in ${repoName}`);

  try {
    // Redeploy preview environment
    await deployPreviewEnvironment(prNumber);
    console.log(`Preview environment updated for PR #${prNumber}`);
  } catch (error) {
    console.error(`Failed to update preview environment:`, error.message);
  }
});

// Handle pull_request.closed event
webhooks.on('pull_request.closed', async ({ payload }) => {
  const prNumber = payload.pull_request.number;
  const repoName = payload.repository.name;
  const merged = payload.pull_request.merged;

  console.log(`\n🧹 PR #${prNumber} ${merged ? 'merged' : 'closed'} in ${repoName}`);

  try {
    // Cleanup preview environment
    await cleanupPreviewEnvironment(prNumber);
    console.log(`Preview environment cleaned up for PR #${prNumber}`);
  } catch (error) {
    console.error(`Failed to cleanup preview environment:`, error.message);
  }
});

// Function to deploy preview environment
async function deployPreviewEnvironment(prNumber) {
  const scriptsDir = path.join(__dirname, '..', 'scripts');
  const deployScript = path.join(scriptsDir, 'deploy-test.sh');

  console.log(`Deploying preview environment for PR #${prNumber}...`);

  try {
    const output = execSync(`${deployScript} ${prNumber}`, {
      cwd: scriptsDir,
      encoding: 'utf8',
    });
    console.log(output);
    return true;
  } catch (error) {
    console.error('Deployment error:', error.message);
    throw error;
  }
}

// Function to cleanup preview environment
async function cleanupPreviewEnvironment(prNumber) {
  const scriptsDir = path.join(__dirname, '..', 'scripts');
  const cleanupScript = path.join(scriptsDir, 'cleanup-test.sh');

  console.log(`🧹 Cleaning up preview environment for PR #${prNumber}...`);

  try {
    const output = execSync(`${cleanupScript} ${prNumber}`, {
      cwd: scriptsDir,
      encoding: 'utf8',
    });
    console.log(output);
    return true;
  } catch (error) {
    console.error('Cleanup error:', error.message);
    throw error;
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`\n Webhook server running on http://localhost:${PORT}`);
  console.log(`Listening for GitHub webhook events...`);
  console.log(`Webhook secret is ${WEBHOOK_SECRET === 'development-secret-123' ? 'using development default' : 'configured'}`);
  console.log(`\nTest the server: curl http://localhost:${PORT}/health\n`);
});

// Error handling
webhooks.onError((error) => {
  console.error('Webhook error:', error);
});
