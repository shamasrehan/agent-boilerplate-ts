# AI Agent Boilerplate Setup Guide

This guide will help you set up the AI Agent Boilerplate for development and production use.

## Directory Structure

The boilerplate follows this structure:

```
ai-agent-boilerplate/
├── dist/                 # Compiled JavaScript files
├── node_modules/         # Dependencies
├── public/               # Static files for the test UI
│   └── index.html        # Test UI interface
├── src/                  # Source code
│   ├── core/             # Core modules
│   │   ├── FunctionManager.ts
│   │   ├── MessagingManager.ts
│   │   ├── JobQueueManager.ts
│   │   └── LLMManager.ts
│   ├── functions/        # Custom functions
│   │   └── weatherFunction.ts
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts
│   ├── Agent.ts          # Main Agent class
│   └── index.ts          # Entry point
├── .env                  # Environment variables
├── .env.example          # Example environment variables
├── package.json          # Project dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── README.md             # Documentation
└── SETUP.md              # This setup guide
```

## Prerequisites

Before setting up the project, ensure you have the following installed:

1. **Node.js** (v16 or higher)
2. **npm** or **yarn**
3. **Redis** (for job queue)
4. **RabbitMQ** (for messaging)

## Step-by-Step Setup

### 1. Clone or Create the Project

Create a new directory and set up the project:

```bash
mkdir ai-agent-boilerplate
cd ai-agent-boilerplate
```

### 2. Initialize the Project

Initialize a new npm project:

```bash
npm init -y
```

### 3. Install Dependencies

Install the required dependencies:

```bash
npm install amqplib axios bullmq dotenv express ioredis jsonschema langchain openai anthropic zod uuid socket.io
```

Install development dependencies:

```bash
npm install -D @types/amqplib @types/express @types/jest @types/node @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint jest prettier ts-jest ts-node ts-node-dev typescript
```

### 4. Set Up TypeScript Configuration

Create a `tsconfig.json` file in the root directory with the configuration provided in the boilerplate.

### 5. Create Directory Structure

Create the necessary directories:

```bash
mkdir -p src/core src/functions src/types dist public
```

### 6. Create Environment Variables

Copy the `.env.example` file to `.env` and fill in your API keys and configuration:

```bash
cp .env.example .env
```

Edit the `.env` file with your specific configuration:
- Add your API keys for OpenAI, Anthropic, etc.
- Configure RabbitMQ connection details
- Set Job Queue parameters

### 7. Create Core Files

Create all the core TypeScript files in their respective directories as provided in the boilerplate.

### 8. Add Custom Functions

Create custom functions in the `src/functions` directory. Each function should follow the pattern shown in `weatherFunction.ts`.

### 9. Build the Project

Compile the TypeScript code:

```bash
npm run build
```

### 10. Start the Agent

Start the agent and test UI:

```bash
npm start
```

The agent will be running at http://localhost:3000 by default.

## Setting Up External Services

### RabbitMQ Setup

1. Install RabbitMQ (https://www.rabbitmq.com/download.html)
2. Start the RabbitMQ server
3. Create the required queues:
   - agent-incoming
   - agent-outgoing
   - agent-acknowledgment

### Redis Setup

1. Install Redis (https://redis.io/download)
2. Start the Redis server
3. Ensure it's running on the default port (6379) or update the connection details in your code

## Docker Setup (Optional)

For containerized deployment, you can use Docker:

1. Create a `Dockerfile`:

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

2. Create a `docker-compose.yml` file:

```yaml
version: '3'
services:
  agent:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - redis
      - rabbitmq
    environment:
      - RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - PORT=3000

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
```

3. Build and run the Docker containers:

```bash
docker-compose up -d
```

## Customizing the Agent

### Adding New Functions

1. Create a new file in `src/functions/` following the pattern in `weatherFunction.ts`
2. The function will be automatically loaded when the agent starts

### Modifying Agent Configuration

Edit the configuration in `src/index.ts` to customize the agent's behavior:

```typescript
const config: AgentConfig = {
  name: 'my-custom-agent',
  version: '1.0.0',
  // Customize other settings...
};
```

### Testing

Test your agent using the provided web interface at http://localhost:3000 or by writing automated tests.

## Troubleshooting

### Common Issues

1. **Connection refused to RabbitMQ or Redis**
   - Ensure the services are running
   - Check the connection URLs in the `.env` file

2. **API key errors**
   - Verify that your API keys are correctly formatted in the `.env` file
   - Check for typos in the API key names

3. **TypeScript compilation errors**
   - Run `npm run build` and check for any compilation errors
   - Fix type issues in your custom code

### Logs

Check the console logs for detailed error messages and debugging information.

## Next Steps

1. Implement your domain-specific logic in custom functions
2. Set up authentication for the agent API if needed
3. Create a production deployment strategy
4. Set up monitoring and logging for the agent

For more detailed information, refer to the README.md file.