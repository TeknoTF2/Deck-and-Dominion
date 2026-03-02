# How to Host Deck & Dominion Online — A Beginner's Guide

This guide walks you through setting up a Deck & Dominion server so you and your friends can play together over the internet. No prior server experience needed — just follow each step.

---

## Table of Contents

1. [What You'll Need](#1-what-youll-need)
2. [Option A: Run on Your Own Computer (Simplest)](#2-option-a-run-on-your-own-computer-simplest)
3. [Option B: Run on a Cloud Server (Recommended for Reliable Online Play)](#3-option-b-run-on-a-cloud-server-recommended-for-reliable-online-play)
4. [Building and Starting the Game Server](#4-building-and-starting-the-game-server)
5. [Letting Friends Connect](#5-letting-friends-connect)
6. [Keeping the Server Running (Cloud Only)](#6-keeping-the-server-running-cloud-only)
7. [Adding a Domain Name and HTTPS (Optional)](#7-adding-a-domain-name-and-https-optional)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. What You'll Need

Before starting, make sure you have:

- **Node.js** (version 18 or higher) — this runs the server
  - Download it from https://nodejs.org (pick the "LTS" version)
  - To check if you already have it, open a terminal and type: `node --version`
- **npm** — comes automatically with Node.js (used to install packages)
- **Git** — to download the game code
  - Download from https://git-scm.com if you don't have it
- **A terminal/command prompt** — Terminal on Mac/Linux, Command Prompt or PowerShell on Windows

---

## 2. Option A: Run on Your Own Computer (Simplest)

This is the easiest way to get started. Your friends connect to your computer directly. The downside: the server only runs while your computer is on, and you'll need to configure your router.

### Step 1: Download the Game Code

Open your terminal and run:

```bash
git clone <your-repo-url> Deck-and-Dominion
cd Deck-and-Dominion
```

Replace `<your-repo-url>` with the actual URL of your repository (e.g., from GitHub).

### Step 2: Install Dependencies

This downloads all the libraries the game needs:

```bash
npm install
```

This may take a minute or two. Wait until it finishes.

### Step 3: Build the Game

This compiles the code into a runnable format:

```bash
npm run build
```

### Step 4: Load the Card Data

This fills the database with all the game's cards:

```bash
npm run seed
```

### Step 5: Start the Server

```bash
npm start
```

You should see:

```
Deck & Dominion server running on port 3000
```

### Step 6: Test It Locally

Open your web browser and go to:

```
http://localhost:3000
```

You should see the Deck & Dominion game interface. If you do, the server is working.

### Step 7: Let Friends Connect Over the Internet

For friends to connect from outside your home network, you need to do two things:

#### a) Find Your Public IP Address

Go to https://whatismyipaddress.com in your browser. Write down the IP address shown (it looks something like `98.45.123.67`).

#### b) Set Up Port Forwarding on Your Router

This tells your router to send game traffic to your computer:

1. Open your router's settings page (usually `http://192.168.1.1` or `http://192.168.0.1` in your browser — check the sticker on your router)
2. Log in (default credentials are often on the router's sticker too)
3. Find the **Port Forwarding** section (sometimes under "Advanced" or "NAT")
4. Create a new rule:
   - **External Port**: `3000`
   - **Internal Port**: `3000`
   - **Internal IP**: Your computer's local IP (find it by running `ipconfig` on Windows or `ifconfig` on Mac/Linux — look for something like `192.168.1.105`)
   - **Protocol**: TCP
5. Save the rule

#### c) Share Your Address

Tell your friends to open their browser and go to:

```
http://YOUR_PUBLIC_IP:3000
```

Replace `YOUR_PUBLIC_IP` with the IP you found in step (a).

---

## 3. Option B: Run on a Cloud Server (Recommended for Reliable Online Play)

A cloud server stays online 24/7 and doesn't depend on your home computer or internet connection. Many providers offer free or cheap tiers that work perfectly for this.

### Popular Cloud Providers (Beginner-Friendly)

| Provider | Free Tier | Difficulty |
|----------|-----------|------------|
| [Railway](https://railway.app) | $5 free credit | Easiest |
| [Render](https://render.com) | Free tier available | Easy |
| [DigitalOcean](https://digitalocean.com) | $4/month droplet | Moderate |
| [AWS Lightsail](https://aws.amazon.com/lightsail/) | $3.50/month | Moderate |

Below are instructions for two approaches: **Railway** (easiest, one-click style) and **DigitalOcean** (more control, traditional server).

---

### Approach 1: Deploy to Railway (Easiest)

Railway can deploy directly from your GitHub repository.

1. **Push your code to GitHub** (if you haven't already)
2. Go to https://railway.app and sign up with your GitHub account
3. Click **"New Project"** then **"Deploy from GitHub repo"**
4. Select your Deck & Dominion repository
5. Railway will auto-detect it's a Node.js app. In the settings, configure:
   - **Build Command**: `npm run build && npm run seed`
   - **Start Command**: `npm start`
6. Railway will assign you a public URL (something like `deck-and-dominion-production.up.railway.app`)
7. Share that URL with your friends — done!

---

### Approach 2: Deploy to a DigitalOcean Droplet (More Control)

#### Step 1: Create a Server

1. Sign up at https://digitalocean.com
2. Click **"Create Droplet"**
3. Choose:
   - **OS**: Ubuntu 22.04 or 24.04
   - **Plan**: Basic, $4-6/month (1 GB RAM is enough)
   - **Region**: Pick one close to where most players are
4. Under **Authentication**, choose **SSH Key** (more secure) or **Password**
5. Click **Create Droplet**
6. Write down the IP address shown (e.g., `143.198.45.123`)

#### Step 2: Connect to Your Server

Open your terminal and connect via SSH:

```bash
ssh root@YOUR_SERVER_IP
```

Replace `YOUR_SERVER_IP` with the IP from step 1. If you chose a password, enter it when prompted.

#### Step 3: Install Node.js

Run these commands one at a time:

```bash
# Update the system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify it installed correctly
node --version
npm --version
```

You should see version numbers (e.g., `v20.x.x` and `10.x.x`).

#### Step 4: Install Git and Clone the Code

```bash
apt install -y git
git clone <your-repo-url> /opt/deck-and-dominion
cd /opt/deck-and-dominion
```

#### Step 5: Install, Build, and Seed

```bash
npm install
npm run build
npm run seed
```

#### Step 6: Test It

```bash
npm start
```

Open your browser and go to `http://YOUR_SERVER_IP:3000`. You should see the game.

Press `Ctrl+C` to stop the server for now — the next section will show you how to keep it running permanently.

---

## 4. Building and Starting the Game Server

Here's a summary of all the commands, in order:

```bash
# 1. Install all dependencies
npm install

# 2. Build the shared types, server, and client
npm run build

# 3. Seed the database with card data
npm run seed

# 4. Start the server
npm start
```

After `npm start`, the server runs on **port 3000** by default. To use a different port:

```bash
PORT=8080 npm start
```

### What Each Command Does

| Command | What It Does |
|---------|-------------|
| `npm install` | Downloads all code libraries the game needs |
| `npm run build` | Compiles TypeScript code and bundles the web interface |
| `npm run seed` | Loads all card definitions into the SQLite database |
| `npm start` | Starts the game server |
| `npm run dev` | Starts in development mode with auto-reload (for developers) |

---

## 5. Letting Friends Connect

Once your server is running, players connect by opening a web browser and going to your server's address.

### If Running on Your Computer (Option A)

- **You (same computer)**: `http://localhost:3000`
- **Same Wi-Fi network**: `http://YOUR_LOCAL_IP:3000` (e.g., `http://192.168.1.105:3000`)
- **Over the internet**: `http://YOUR_PUBLIC_IP:3000` (requires port forwarding, see Option A Step 7)

### If Running on a Cloud Server (Option B)

- **Everyone**: `http://YOUR_SERVER_IP:3000`

### How to Play

1. The first player opens the URL and enters their name
2. They create a lobby — a **lobby code** will be shown
3. Share that lobby code with your friends
4. Other players open the same URL, enter their names, and join using the code
5. Each player picks a class (Commander, DPS, Wizard, Sorcerer, or Crafter) and selects a deck
6. One player can volunteer to be the Dungeon Master (DM)
7. When everyone is ready, the host starts the game

---

## 6. Keeping the Server Running (Cloud Only)

If you just run `npm start` on a cloud server and close your terminal, the server will stop. Here's how to keep it running permanently.

### Option 1: Using PM2 (Recommended)

PM2 is a process manager that keeps your server alive and restarts it if it crashes.

```bash
# Install PM2 globally
npm install -g pm2

# Start the server with PM2
cd /opt/deck-and-dominion
pm2 start npm --name "deck-and-dominion" -- start

# Make PM2 start automatically when the server reboots
pm2 startup
pm2 save
```

Useful PM2 commands:

```bash
pm2 status              # Check if the server is running
pm2 logs                # View server logs (press Ctrl+C to exit)
pm2 restart deck-and-dominion   # Restart the server
pm2 stop deck-and-dominion      # Stop the server
```

### Option 2: Using screen (Simpler but Less Robust)

```bash
# Start a screen session
screen -S game

# Start the server
cd /opt/deck-and-dominion
npm start

# Detach from screen: press Ctrl+A, then D
# The server keeps running after you disconnect

# To reattach later:
screen -r game
```

---

## 7. Adding a Domain Name and HTTPS (Optional)

Instead of sharing an IP address like `http://143.198.45.123:3000`, you can use a proper domain name like `https://deckdominion.example.com`. This also adds encryption (HTTPS) so connections are secure.

### Step 1: Buy a Domain Name

Purchase a domain from a registrar like [Namecheap](https://namecheap.com), [Cloudflare](https://cloudflare.com), or [Google Domains](https://domains.google). Prices start around $10/year.

### Step 2: Point Your Domain to Your Server

In your domain registrar's DNS settings, add an **A record**:

- **Type**: A
- **Name**: `@` (or a subdomain like `game`)
- **Value**: Your server's IP address
- **TTL**: 3600 (or "Auto")

Wait 5-30 minutes for DNS to update.

### Step 3: Install Nginx (Reverse Proxy)

Nginx sits in front of your game server and handles HTTPS:

```bash
apt install -y nginx
```

### Step 4: Configure Nginx

Create a configuration file:

```bash
nano /etc/nginx/sites-available/deck-and-dominion
```

Paste this (replace `yourdomain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The `Upgrade` and `Connection` headers are important — they allow the real-time WebSocket connections that the game relies on.

Enable the site and restart Nginx:

```bash
ln -s /etc/nginx/sites-available/deck-and-dominion /etc/nginx/sites-enabled/
nginx -t          # Test the config (should say "ok")
systemctl restart nginx
```

Now your game is accessible at `http://yourdomain.com` (no port number needed).

### Step 5: Add HTTPS with Let's Encrypt (Free)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

Follow the prompts (enter your email, agree to terms). Certbot will automatically configure HTTPS and set up auto-renewal.

Your game is now available at `https://yourdomain.com`.

---

## 8. Troubleshooting

### "npm install" fails

- Make sure Node.js is version 18+: `node --version`
- Try deleting `node_modules` and running again: `rm -rf node_modules && npm install`

### "npm run build" fails

- Check that `npm install` completed successfully first
- Make sure you're in the `Deck-and-Dominion` root folder (not inside `server/` or `client/`)

### Server starts but friends can't connect

- **Firewall**: If on a cloud server, make sure port 3000 is open:
  ```bash
  ufw allow 3000
  ```
- **Port forwarding**: If on your home computer, double-check your router's port forwarding settings
- **Correct IP**: Make sure you're sharing the right IP address

### Page loads but the game doesn't work (blank screen, errors)

- Open browser developer tools (press F12) and check the Console tab for errors
- Make sure `npm run build` completed without errors
- Make sure `npm run seed` was run so cards are in the database

### "Address already in use" error

Another program is using port 3000. Either stop that program or use a different port:

```bash
PORT=8080 npm start
```

### Server crashes or stops unexpectedly

- Check the logs: `pm2 logs` (if using PM2)
- The most common cause is running out of memory. Consider upgrading your server or closing other programs

### Players get disconnected

- The game has a **60-second reconnection window** — if a player loses connection briefly, they can rejoin automatically
- For persistent issues, check your internet connection and server stability

---

## Quick Reference

| What | Command / Value |
|------|----------------|
| Install dependencies | `npm install` |
| Build for production | `npm run build` |
| Seed card database | `npm run seed` |
| Start server | `npm start` |
| Default port | `3000` |
| Change port | `PORT=8080 npm start` |
| Health check URL | `http://YOUR_SERVER:3000/api/health` |
| Development mode | `npm run dev` |
