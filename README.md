# 🚀 Deploy Node.js App to AWS EC2 (Amazon Linux)

This guide explains how to **set up a Node.js app**, **configure environment variables**, **create an RDS database**, and **deploy** your app on **AWS EC2 (Amazon Linux 2)** using **User Data**.

---

## 📂 Step 1: Set Up the App Locally

1. **Install Node.js and npm**

   Download and install from [https://nodejs.org/](https://nodejs.org/)

2. **Clone your Node.js project**

   ```bash
   git clone https://github.com/alaabenhmida/backend.git
   cd backend
   npm install
   ```

3. **Test the app locally**

   ```bash
   npm start
   ```

   Make sure the app runs correctly on your local machine.

---

## 📅 Step 2: Set Up the Database with AWS RDS

1. Go to the [AWS RDS Console](https://console.aws.amazon.com/rds/)
2. Click **Create database**
3. Choose **Standard Create**
4. Select **Engine** (e.g., MySQL, PostgreSQL)
5. Configure your DB instance:
   - **DB instance identifier**: your-database-name
   - **Master username**: your-username
   - **Master password**: your-password
6. Enable **Public access** (for quick testing; in production prefer private access)
7. Create the database and wait until it's available.

8. **Save the following credentials**:
   - DB_HOST (endpoint)
   - DB_USER (master username)
   - DB_PASSWORD (master password)
   - DB_NAME (database name you created)

---

## 🔧 Step 3: Update Environment Variables

Before deploying:

1. Open your project's `.env` file
2. Choose your storage mode:

   Use JSON file storage (no database required):

   ```bash
   USE_JSON_STORAGE=true
   ```

   Or use MySQL/RDS:

   ```bash
   USE_JSON_STORAGE=false
   DB_HOST=your-rds-endpoint
   DB_USER=your-rds-username
   DB_PASSWORD=your-rds-password
   DB_NAME=your-database-name
   ```

   When `USE_JSON_STORAGE=true`, users are stored in `data/users.json`.

3. If you use MySQL/RDS, update the variables with your RDS credentials:

   ```bash
   DB_HOST=your-rds-endpoint
   DB_USER=your-rds-username
   DB_PASSWORD=your-rds-password
   DB_NAME=your-database-name
   ```

4. Save the file.

---

## 💪 Step 4: Push the App to GitHub

1. **Initialize Git and push your project**

   ```bash
   git init
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git add .
   git commit -m "Initial commit with environment variables configured"
   git branch -M main
   git push -u origin main
   ```

Now your backend app is ready in GitHub!

---

## ☁️ Step 5: Launch an EC2 Instance (Amazon Linux 2)

1. Go to the [AWS EC2 Console](https://console.aws.amazon.com/ec2/)
2. Click **Launch Instance**
3. Configure:
   - **AMI**: Amazon Linux 2 (64-bit)
   - **Instance Type**: `t2.micro`
   - **Key Pair**: Select or create one
   - **Security Group**: Allow:
     - **Port 22** (SSH)
     - **Port 80** (HTTP)
     - **Port 3000** (or the port your Node.js app uses)
4. Expand **Advanced details** → **User Data** section
5. Paste the script below into **User Data**

---

## 🔧 Step 6: EC2 User Data Script (for Amazon Linux 2)

```bash
#!/bin/bash -xe

# Update system packages
sudo yum update -y

# Install Node.js
sudo curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
sudo yum install -y nodejs

# Install dev tools (needed for some npm packages)
sudo yum install -y gcc-c++ make git

# Install Nginx
sudo yum install -y nginx

# Configure Nginx to proxy to your Node.js application
sudo tee /etc/nginx/conf.d/app.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Create app directory
sudo mkdir -p /home/ec2-user/app
cd /home/ec2-user/app

# Clone your application (replace with your actual repository URL)
sudo git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .


# Install application dependencies
sudo npm install

# Install PM2 globally
sudo npm install -g pm2

# Start your application with PM2
pm2 start index.js

# Set PM2 to start on system boot
pm2 startup
env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user
pm2 save

# Set appropriate permissions
chown -R ec2-user:ec2-user /home/ec2-user/app

# Log the completion
echo "Application setup completed" > /home/ec2-user/setup-completed.log
```

> 🔁 Replace `YOUR_USERNAME`, `YOUR_REPO`, and database credentials with your actual values.

---

## 🌐 Step 7: Access the Deployed App

Once your EC2 instance is running, open your browser and visit:

```
http://<your-ec2-public-ip>:3000
```

Your Node.js app connected to AWS RDS is now live! 🎉

---

## ⚡ Quick Recap

- Create and configure RDS
- Update `.env` with correct variables
- Push your Node.js app to GitHub
- Launch an EC2 instance with User Data script
- Your backend app is online!

---

