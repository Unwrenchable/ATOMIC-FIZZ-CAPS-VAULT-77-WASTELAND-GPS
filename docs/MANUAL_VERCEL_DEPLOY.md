# Manual Vercel Deployment

This workflow allows you to manually trigger a Vercel deployment, bypassing automatic Git-based deployments. This is useful when:
- Vercel's automatic deployments are rate-limited or paused
- You've hit your build minute quota for the day/month
- You need to force a deployment without making a new commit

## Setup

### 1. Create a Vercel Token

1. Go to [Vercel Account Settings → Tokens](https://vercel.com/account/tokens)
2. Create a new token with a descriptive name (e.g., "GitHub Actions Deploy")
3. Copy the token value

### 2. Add GitHub Secret

1. Go to your repository settings on GitHub
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Name: `VERCEL_TOKEN`
5. Value: Paste your Vercel token
6. Click **Add secret**

### 3. Configure Vercel Project

The workflow requires your Vercel project configuration. Add these as GitHub repository secrets:

1. **VERCEL_ORG_ID**: Your Vercel organization/team ID
2. **VERCEL_PROJECT_ID**: Your Vercel project ID

**How to get these values:**

Run these commands locally in your project directory:
```bash
npm install -g vercel
vercel link
```

This creates a `.vercel/project.json` file. View its contents:
```bash
cat .vercel/project.json
```

You'll see something like:
```json
{
  "orgId": "team_xxxxxxxxxxxxx",
  "projectId": "prj_xxxxxxxxxxxxx"
}
```

Add these values as GitHub secrets:
- `VERCEL_ORG_ID` = the `orgId` value
- `VERCEL_PROJECT_ID` = the `projectId` value

## Usage

### Trigger a Manual Deployment

1. Go to the **Actions** tab in your GitHub repository
2. Select **Manual Vercel Deployment** from the workflows list
3. Click **Run workflow**
4. Choose the environment:
   - **production**: Deploy to production (atomicfizzcaps.xyz)
   - **preview**: Deploy to a preview URL
5. Click **Run workflow**

The workflow will:
1. Pull your Vercel environment configuration
2. Build the project artifacts
3. Deploy to Vercel

### Monitoring

- Check the workflow run logs in GitHub Actions for deployment status
- The deployment URL will be shown in the logs
- You can also monitor deployments in the Vercel dashboard

## How It Works

This workflow uses the Vercel CLI to deploy your project programmatically, independent of Vercel's Git integration. This means:

- ✅ Works even if automatic deployments are paused
- ✅ Works when you've hit build minute limits
- ✅ Can deploy any branch or commit
- ✅ Full control over when deployments happen

The deployment still counts against your Vercel plan's build minutes, but it gives you manual control to deploy when you choose, rather than on every Git push.

## Troubleshooting

### "Error: No token found"
- Make sure you've added the `VERCEL_TOKEN` secret to your GitHub repository

### "Error: Project not found" or "Error: No Project Settings found"
- Ensure you've added both `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` secrets
- Run `vercel link` locally to get these values from `.vercel/project.json`
- Verify the token has access to the correct Vercel project and organization

### "Build failed"
- Check the build logs in the workflow run
- Ensure your `vercel.json` configuration is correct
- Verify all required environment variables are set in Vercel project settings

## Alternative: Vercel CLI Deployment (Local)

You can also deploy manually from your local machine:

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link to your project (first time only)
vercel link

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

This is useful for quick deployments from your development environment.
