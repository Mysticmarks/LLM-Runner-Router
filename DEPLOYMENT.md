# Deployment Guide

## GitHub Setup

1. **Initialize Git Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: LLM Runner Router project setup"
   ```

2. **Create GitHub Repository**
   - Go to GitHub and create a new repository named `llm-runner-router`
   - Connect your local repository:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/llm-runner-router.git
   git branch -M main
   git push -u origin main
   ```

3. **GitHub Actions**
   - Workflows are already configured in `.github/workflows/`
   - CI/CD will run automatically on push to main branch
   - Set up the following secrets in GitHub repository settings:
     - `NETLIFY_AUTH_TOKEN`: Your Netlify personal access token
     - `NETLIFY_SITE_ID`: Your Netlify site ID
     - `NPM_TOKEN`: NPM token for publishing packages (optional)

## Netlify Deployment

### Option 1: Connect GitHub Repository
1. Go to [Netlify](https://netlify.com)
2. Click "New site from Git"
3. Choose GitHub and select your `llm-runner-router` repository
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: `20`

### Option 2: Manual Deploy
1. Build the project locally:
   ```bash
   npm run build
   ```
2. Drag and drop the `dist` folder to Netlify

### Environment Variables
Set these in Netlify dashboard under "Site settings" > "Environment variables":
- `NODE_VERSION`: `20`
- `NPM_FLAGS`: `--prefix=/opt/buildhome/.nodejs`

## Deployment Commands

```bash
# Build for production
npm run build

# Test the build
npm test

# Lint code
npm run lint

# Start development server
npm run dev
```

## GitHub Actions Workflows

### CI/CD Pipeline (`.github/workflows/ci.yml`)
- Runs on push to main/develop and pull requests
- Tests on Node.js 18.x and 20.x
- Runs linting, tests, and builds
- Deploys to Netlify on main branch pushes

### Release Pipeline (`.github/workflows/release.yml`)
- Runs on version tags (v*)
- Creates GitHub releases
- Publishes to NPM (optional)

## Post-Deployment Checklist

- [ ] GitHub repository created and connected
- [ ] GitHub Actions workflows running successfully
- [ ] Netlify site deployed and accessible
- [ ] Environment variables configured
- [ ] Domain configured (if custom domain needed)
- [ ] HTTPS enabled (automatic with Netlify)
- [ ] Monitoring set up (optional)

## Troubleshooting

### Build Failures
- Check Node.js version (should be 18+ for local, 20 for deployment)
- Verify all dependencies are installed
- Check for ESLint warnings (they won't fail the build but should be addressed)

### Deployment Issues
- Verify Netlify build settings match the configuration
- Check environment variables are set correctly
- Review build logs in Netlify dashboard

### GitHub Actions Failures
- Check secrets are configured correctly
- Verify workflow syntax in `.github/workflows/`
- Review action logs for specific errors

## Security Notes

- Sensitive data should be stored in environment variables
- API keys should never be committed to the repository
- Use GitHub secrets for deployment tokens
- Enable branch protection rules for main branch