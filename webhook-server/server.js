const express = require('express');
const { Webhooks } = require('@octokit/webhooks');
const { Octokit } = require('@octokit/rest');
const bodyParser = require('body-parser');
const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'development-secret-123';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;

// Initialize GitHub API client
const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

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
    timestamp: new Date().toISOString(),
    github: {
      tokenConfigured: !!GITHUB_TOKEN,
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
    }
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
        .info {
          background: rgba(255, 255, 255, 0.1);
          padding: 10px;
          border-radius: 5px;
          margin: 10px 0;
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
        <div class="info">
          <strong>Repository:</strong> ${GITHUB_OWNER || 'Not configured'}/${GITHUB_REPO || 'Not configured'}<br>
          <strong>GitHub Token:</strong> ${GITHUB_TOKEN ? 'Configured' : 'Not configured'}
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
  const repoOwner = payload.repository.owner.login;

  console.log(`\nPR #${prNumber} opened in ${repoName}`);
  console.log(`Title: ${payload.pull_request.title}`);
  console.log(`Author: ${payload.pull_request.user.login}`);

  try {
    // Post "deploying" comment
    await postComment(repoOwner, repoName, prNumber,
      '**Preview Environment Deploying...**\n\nPlease wait while your preview environment is being created.'
    );

    // Deploy preview environment
    await deployPreviewEnvironment(prNumber);
    console.log(`Preview environment deployed for PR #${prNumber}`);

    // Post success comment with instructions
    await postComment(repoOwner, repoName, prNumber,
      `## Preview Environment Ready!\n\n` +
      `Your preview environment has been deployed successfully.\n\n` +
      `### Access Your Preview\n` +
      `To access this preview locally, run:\n` +
      `\`\`\`bash\n` +
      `kubectl port-forward -n pr-${prNumber} svc/sample-app-service 8${prNumber}:3000\n` +
      `\`\`\`\n` +
      `Then visit: **http://localhost:8${prNumber}**\n\n` +
      `### Environment Details\n` +
      `- **Namespace:** \`pr-${prNumber}\`\n` +
      `- **Status:** Running\n` +
      `- **Deployment:** \`sample-app\`\n\n` +
      `This environment will be automatically cleaned up when the PR is closed or merged.`
    );

  } catch (error) {
    console.error(`Failed to deploy preview environment:`, error.message);

    // Post error comment
    await postComment(repoOwner, repoName, prNumber,
      `## Preview Environment Deployment Failed\n\n` +
      `There was an error deploying your preview environment.\n\n` +
      `**Error:** ${error.message}\n\n` +
      `Please check the logs or contact the maintainer.`
    );
  }
});

// Handle pull_request.synchronize event (new commits pushed)
webhooks.on('pull_request.synchronize', async ({ payload }) => {
  const prNumber = payload.pull_request.number;
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;

  console.log(`\nPR #${prNumber} updated in ${repoName}`);

  try {
    await postComment(repoOwner, repoName, prNumber,
      '**Preview Environment Updating...**\n\nYour preview environment is being updated with the latest changes.'
    );

    // Redeploy preview environment
    await deployPreviewEnvironment(prNumber);
    console.log(`Preview environment updated for PR #${prNumber}`);

    await postComment(repoOwner, repoName, prNumber,
      '**Preview Environment Updated!**\n\nYour preview environment has been updated with the latest changes.'
    );

  } catch (error) {
    console.error(`Failed to update preview environment:`, error.message);
  }
});

// Handle pull_request.closed event
webhooks.on('pull_request.closed', async ({ payload }) => {
  const prNumber = payload.pull_request.number;
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const merged = payload.pull_request.merged;

  console.log(`\n🧹 PR #${prNumber} ${merged ? 'merged' : 'closed'} in ${repoName}`);

  try {
    // Cleanup preview environment
    await cleanupPreviewEnvironment(prNumber);
    console.log(`Preview environment cleaned up for PR #${prNumber}`);

    await postComment(repoOwner, repoName, prNumber,
      `## Preview Environment Cleaned Up\n\n` +
      `The preview environment for this PR has been deleted.\n\n` +
      `**Status:** ${merged ? 'Merged' : 'Closed'}`
    );

  } catch (error) {
    console.error(`Failed to cleanup preview environment:`, error.message);
  }
});

// Function to post comment on PR
async function postComment(owner, repo, prNumber, body) {
  if (!GITHUB_TOKEN) {
    console.log('GitHub token not configured, skipping comment');
    return;
  }

  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    console.log(`Posted comment on PR #${prNumber}`);
  } catch (error) {
    console.error('Failed to post comment:', error.message);
  }
}

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

  console.log(`Cleaning up preview environment for PR #${prNumber}...`);

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
  console.log(`\nWebhook server running on http://localhost:${PORT}`);
  console.log(`Listening for GitHub webhook events...`);
  console.log(`Webhook secret: ${WEBHOOK_SECRET === 'development-secret-123' ? 'development mode' : 'configured'}`);
  console.log(`GitHub token: ${GITHUB_TOKEN ? 'configured' : 'not configured (comments disabled)'}`);
  console.log(`Repository: ${GITHUB_OWNER || 'not set'}/${GITHUB_REPO || 'not set'}`);
  console.log(`\nTest: curl http://localhost:${PORT}/health\n`);
});

// Error handling
webhooks.onError((error) => {
  console.error('Webhook error:', error);
});
