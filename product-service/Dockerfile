# Use a lightweight Node.js image as the base
FROM node:24-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# The files are now copied from the service directory itself
COPY package.json .
COPY package-lock.json .

# Install dependencies
RUN npm install

# Copy the application source code
COPY . .

# Expose the port the app runs on (this is for documentation, mapping is done by docker-compose)
EXPOSE 3002

# Define the command to run the application
CMD [ "node", "server.js" ]