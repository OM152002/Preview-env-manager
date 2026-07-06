# Preview Environment Manager
**License:** [MIT](LICENSE)

A tool that automatically creates test environments for GitHub pull requests. Think of it like how Vercel gives you a preview link for every PR, but this works for any app running on Kubernetes.

## Why I Built This

When reviewing pull requests, you usually just read the code and hope it works. But what if you could actually *see* the changes running live? That's what this does. It spins up a complete copy of your app for every PR, lets you test it, and cleans up when you're done.

## What It Does

- Creates a new Kubernetes environment when you open a PR
- Posts a comment on GitHub with instructions to access it
- Updates the environment when you push new commits
- Deletes everything when you close the PR

No manual work needed. Just open a PR and the bot handles the rest.

## How It Works
```
GitHub PR → Webhook → My Server → Kubernetes → Running App
```

1. You create a pull request
2. GitHub sends a webhook to my server
3. Server creates a Kubernetes namespace and deploys your code
4. Bot comments on the PR with access info
5. When you close the PR, everything gets cleaned up automatically

## Tech Stack

**Server Side:**
- Node.js + Express (webhook server)
- GitHub API (for posting comments)

**Infrastructure:**
- Kubernetes (kind for local development)
- Docker (containerization)
- kubectl (deployment management)

**Tools:**
- ngrok (to expose my local server to GitHub)
- Bash scripts (automate deployments)

## Setup

You'll need Docker, Node.js, kubectl, and kind installed.

**1. Start Kubernetes cluster:**
```bash
kind create cluster --config kind-config.yaml
```

**2. Build and load the sample app:**
```bash
cd sample-app
docker build -t sample-app:v1 .
kind load docker-image sample-app:v1 --name preview-env-cluster
```

**3. Configure the webhook server:**
```bash
cd webhook-server
npm install

# Create .env file with your GitHub token
WEBHOOK_SECRET=your_secret
GITHUB_TOKEN=your_token
GITHUB_OWNER=your_username
GITHUB_REPO=your_repo
```

**4. Start the server:**
```bash
node server.js
```

**5. Expose it with ngrok:**
```bash
ngrok http 4000
```

**6. Add webhook to GitHub:**
- Go to your repo → Settings → Webhooks
- Payload URL: `https://your-ngrok-url.ngrok.io/webhook`
- Content type: `application/json`
- Secret: same as your WEBHOOK_SECRET
- Select "Pull requests" events

## Using It

Create a PR and the bot will comment with something like this:
```
Preview Environment Ready!

To access this preview:
kubectl port-forward -n pr-1 svc/sample-app-service 8001:3000

Then visit: http://localhost:8001
```

Run that command and you can test your changes before merging.

## Project Structure
```
preview-env-manager/
├── webhook-server/     # Express server that receives webhooks
├── sample-app/         # Demo app (Node.js) that gets deployed
├── k8s-configs/        # Kubernetes templates
├── scripts/            # Deployment automation scripts
└── docs/              # Architecture docs
```

## What I Learned

- How to handle GitHub webhooks and verify signatures
- Kubernetes basics (namespaces, deployments, services)
- Automating infrastructure with scripts
- Building systems that react to events

## Limitations

Right now this is set up for local development with kind. In a real production setup you'd want:
- Actual domain names instead of localhost
- Better scaling (Currently it only supports PR numbers 1-99)
- Database per environment
- Better monitoring and logging

But it works great for demonstrating the concept and learning DevOps fundamentals.

## Future Ideas

- Add database seeding for each environment
- Support multiple apps/services per PR
- Slack/Discord notifications
- Auto-expire old environments

## License

MIT - do whatever you want with it

## Contact

Built by Om Patel while learning Kubernetes and CI/CD
- GitHub: [@OM152002](https://github.com/OM152002)
- Email: opatel7@asu.edu
