#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# -----------------------------
# Configuration
# -----------------------------
PM2_APP_NAME="clinic-direct"
NGINX_SERVICE="nginx"

# Deploy target on the server. Override at call time:
#   TARGET_DIR=/srv/apps/clinic ./deploy.sh
TARGET_DIR="${TARGET_DIR:-/home/ubuntu/clinic-direct}"

# Repo + branch to deploy. Auto-detected when this script runs from an
# existing checkout; override with REPO_URL=... DEPLOY_BRANCH=... ./deploy.sh
REPO_URL="${REPO_URL:-$(git config --get remote.origin.url 2>/dev/null || echo "https://github.com/vipinpal70/clinic-direct.git")}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "master")}"

echo "=========================================="
echo "Starting deployment"
echo "Target : $TARGET_DIR"
echo "Repo   : $REPO_URL"
echo "Branch : $DEPLOY_BRANCH"
echo "=========================================="

# -----------------------------
# Step 0 - Ensure target folder exists
# -----------------------------
if [ ! -d "$TARGET_DIR/.git" ]; then
    echo "📁 Step 0: '$TARGET_DIR' is not a git checkout — creating it..."

    # Create the folder; fall back to sudo when the parent isn't writable
    if ! mkdir -p "$TARGET_DIR" 2>/dev/null; then
        sudo mkdir -p "$TARGET_DIR"
    fi

    # Hand ownership to the current user so git / npm / pm2 can write
    sudo chown -R "$(id -un):$(id -gn)" "$TARGET_DIR"
    chmod -R u+rwX "$TARGET_DIR"

    echo "📥 Cloning '$DEPLOY_BRANCH' into '$TARGET_DIR'..."
    git clone --branch "$DEPLOY_BRANCH" "$REPO_URL" "$TARGET_DIR"
fi

cd "$TARGET_DIR"
PROJECT_DIR="$(pwd)"
echo "Project: $PROJECT_DIR"

if [ ! -f .env ] && [ ! -f .env.production ]; then
    echo "⚠️  No .env / .env.production in $PROJECT_DIR — add it before the build step."
fi

# -----------------------------
# Step 1 - Pull latest code
# -----------------------------
echo "🚀 Step 1: Pulling latest changes..."
git fetch origin "$DEPLOY_BRANCH"
git checkout "$DEPLOY_BRANCH"
git pull origin "$DEPLOY_BRANCH"

# -----------------------------
# Step 2 - Install dependencies
# -----------------------------
echo "📦 Step 2: Installing dependencies..."

if [ -f package-lock.json ]; then
    npm ci
else
    npm install
fi

# -----------------------------
# Step 3 - Build application
# -----------------------------
echo "🛠️ Step 3: Building production application..."
npm run build

# -----------------------------
# Step 4 - Start/Reload PM2
# -----------------------------
echo "🚀 Step 4: Starting/Reloading PM2..."

if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then

    echo "PM2 process exists."

    # Check if the process is currently online
    PM2_STATUS=$(pm2 jlist | node -e "
        let input = '';
        process.stdin.on('data', d => input += d);
        process.stdin.on('end', () => {
            try {
                const apps = JSON.parse(input);
                const app = apps.find(a => a.name === '$PM2_APP_NAME');
                console.log(app ? app.pm2_env.status : 'not-found');
            } catch {
                console.log('not-found');
            }
        });
    ")

    if [ "$PM2_STATUS" = "online" ]; then
        echo "Reloading existing PM2 process..."
        pm2 reload "$PM2_APP_NAME"
    else
        echo "PM2 process exists but is not running."
        echo "Starting existing PM2 process..."
        pm2 start "$PM2_APP_NAME"
    fi

else

    echo "PM2 process does not exist."
    echo "Creating new PM2 process..."

    pm2 start npm \
        --name "$PM2_APP_NAME" \
        --cwd "$PROJECT_DIR" \
        -- start

fi

# Save PM2 process list
echo "💾 Saving PM2 process list..."
pm2 save

# -----------------------------
# Step 5 - Test & Reload Nginx
# -----------------------------
echo "🌐 Step 5: Testing Nginx configuration..."

sudo nginx -t

echo "Reloading Nginx..."
sudo systemctl reload "$NGINX_SERVICE"

# -----------------------------
# Step 6 - Show application status
# -----------------------------
echo "=========================================="
echo "✅ Deployment completed successfully!"
echo "=========================================="

echo ""
echo "Application Status:"
pm2 status "$PM2_APP_NAME"
