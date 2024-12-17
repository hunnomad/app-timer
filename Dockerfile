# Node.js alap image
FROM node:18

# Create a working directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Environment variables
COPY .env .env

# Open port
EXPOSE 3000

# Launch application
CMD ["node", "app.js"]
