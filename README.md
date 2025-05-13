# AI Agent Boilerplate

A standardized TypeScript boilerplate for building AI agents with modular components for function management, messaging, job queues, and LLM integration.

## Features

- **Function Manager**: Create, manage, and execute custom functions with support for cloud functions and API key management
- **Messaging Manager**: Communicate with external systems via RabbitMQ, with support for schemas and acknowledgments
- **Job Queue**: Schedule and manage jobs with priority, delays, and retries
- **LLM Manager**: Interact with AI models from providers like OpenAI, Anthropic, and Google

## Table of Contents

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Usage](#usage)
  - [Function Manager](#function-manager)
  - [Messaging Manager](#messaging-manager)
  - [Job Queue](#job-queue)
  - [LLM Manager](#llm-manager)
- [Creating Custom Functions](#creating-custom-functions)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- RabbitMQ server (for messaging)
- Redis server (for job queue)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/ai-agent-boilerplate.git
cd ai-agent-boilerplate
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Edit the `.env` file with your API keys and configuration settings.

4. Build the project:

```bash
npm run build
```

### Configuration

The agent is configured using environment variables in the `.env` file. Key configuration options include:

- API keys for various services
- RabbitMQ connection details
- Job Queue settings
- LLM provider and model selection

## Usage

### Basic Usage

Start the agent with default configuration:

```bash
npm start
```

This will start the agent and a test web interface at http://localhost:3000.

### Function Manager

The Function Manager allows you to register, manage, and execute custom functions:

```typescript
import { FunctionManager } from './src/core/FunctionManager';

// Create a new Function Manager
const functionManager = new FunctionManager();

// Register a function
functionManager.registerFunction({
  name: 'multiply',
  description: 'Multiply two numbers',
  type: 'local',
  parameters: {
    type: 'object',
    properties: {
      a: { type: 'number' },
      b: { type: 'number' }
    },
    required: ['a', 'b']
  },
  handler: async (params) => {
    return params.a * params.b;
  }
});

// Execute a function
const result = await functionManager.executeFunction('multiply', { a: 5, b: 3 });
console.log(result); // 15
```

### Messaging Manager

The Messaging Manager handles communication with external systems via RabbitMQ:

```typescript
import { MessagingManager } from './src/core/MessagingManager';

// Create a new Messaging Manager
const messagingManager = new MessagingManager({
  incomingQueue: 'agent-incoming',
  outgoingQueue: 'agent-outgoing',
  acknowledgmentQueue: 'agent-acknowledgment'
});

// Initialize the connection
await messagingManager.initialize('amqp://guest:guest@localhost:5672');

// Listen for incoming messages
messagingManager.on('message', async (message) => {
  console.log('Received message:', message);
  
  // Process the message...
  
  // Send an acknowledgment
  await messagingManager.sendAcknowledgment(message.id, 'success', { processed: true });
});

// Send a message
await messagingManager.sendMessage('example', { data: 'Hello world!' });
```

### Job Queue

The Job Queue allows you to schedule and manage background jobs:

```typescript
import { JobQueueManager } from './src/core/JobQueueManager';

// Create a new Job Queue Manager
const jobQueueManager = new JobQueueManager({
  concurrency: 5,
  retryAttempts: 3,
  retryDelay: 5000
});

// Schedule a job
const jobId = await jobQueueManager.addJob({
  name: 'processData',
  data: {
    url: 'https://example.com/data.csv',
    format: 'csv'
  },
  priority: 1
});

// Get job status
const status = await jobQueueManager.getJobStatus(jobId);
console.log('Job status:', status);
```

### LLM Manager

The LLM Manager provides an interface for interacting with AI language models:

```typescript
import { LLMManager } from './src/core/LLMManager';

// Create a new LLM Manager
const llmManager = new LLMManager({
  provider: 'openai',
  model: 'gpt-4',
  apiKeyName: 'openai',
  temperature: 0.7
});

// Generate a simple completion
const completion = await llmManager.generateCompletion('Tell me a joke about AI');
console.log(completion);

// Have a conversation
const { response, updatedHistory } = await llmManager.chat(
  'What is machine learning?',
  [], // Start a new conversation
  { temperature: 0.5 }
);
console.log(response.content);
```

## Creating Custom Functions

To create a custom function:

1. Create a new file in the `src/functions` directory:

```typescript
// src/functions/customFunction.ts
import { FunctionDefinition } from '../types';

export const functionDefinition: FunctionDefinition = {
  name: 'customFunction',
  description: 'A custom function',
  type: 'local',
  parameters: {
    type: 'object',
    properties: {
      // Define parameters here
    },
    required: []
  },
  handler: async (params) => {
    // Function implementation
    return { result: 'success' };
  }
};

// Register function with the Function Manager
export default function register(functionManager: any) {
  functionManager.registerFunction(functionDefinition);
}
```

2. The function will be automatically loaded when the agent starts.

## Testing

The boilerplate includes a simple web interface for testing at http://localhost:3000 when the agent is running.

You can also run automated tests:

```bash
npm test
```

## Project Structure

```
ai-agent-boilerplate/
├── dist/                 # Compiled JavaScript files
├── node_modules/         # Dependencies
├── public/               # Static files for the test UI
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
└── README.md             # Documentation

## Setting Up a New Agent

To set up a new agent using this boilerplate:

1. Install the dependencies and configure the environment as described above.

2. Create your custom functions in the `src/functions` directory.

3. Customize the agent configuration in `src/index.ts`:

```typescript
const config: AgentConfig = {
  name: 'my-agent',
  version: '1.0.0',
  functions: {
    enabled: true,
    registry: ['custom-functions'] // Your function directories
  },
  messaging: {
    enabled: true,
    config: {
      incomingQueue: 'my-agent-incoming',
      outgoingQueue: 'my-agent-outgoing',
      acknowledgmentQueue: 'my-agent-acknowledgment'
    }
  },
  jobQueue: {
    enabled: true,
    concurrency: 10,
    retryAttempts: 3,
    retryDelay: 5000
  },
  llm: {
    enabled: true,
    config: {
      provider: 'openai', // or 'anthropic', 'google'
      model: 'gpt-4', // Choose your preferred model
      apiKeyName: 'openai',
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: 'You are a specialized AI agent for [your niche].'
    }
  }
};
```

4. Start your agent:

```bash
npm start
```

## Advanced Usage

### Creating a Custom Agent

You can extend the base Agent class to create a custom agent with specialized behavior:

```typescript
import { Agent } from './src/Agent';
import { AgentConfig } from './src/types';

class CustomAgent extends Agent {
  constructor(config: AgentConfig) {
    super(config);
  }
  
  // Override or add methods as needed
  async handleSpecializedTask(params: any): Promise<any> {
    // Custom implementation
  }
}

const customAgent = new CustomAgent({
  name: 'custom-agent',
  version: '1.0.0',
  // other configuration...
});

await customAgent.initialize();
```

### Integrating with External Systems

The messaging system allows integration with external systems:

```typescript
// Set up message schemas
const schema = {
  name: 'customMessage',
  schema: {
    type: 'object',
    properties: {
      action: { type: 'string' },
      data: { type: 'object' }
    },
    required: ['action']
  }
};

const messagingManager = agent.getMessagingManager();
if (messagingManager) {
  messagingManager.registerOutgoingSchema(schema);
  
  // Send a message to an external system
  await messagingManager.sendMessage('customMessage', {
    action: 'update',
    data: { id: '123', status: 'completed' }
  });
}
```

### Using the LLM for Function Selection

You can use the LLM to determine which functions to execute:

```typescript
const llmManager = agent.getLLMManager();
const functionManager = agent.getFunctionManager();

if (llmManager && functionManager) {
  // Get all function schemas
  const functionSchemas = functionManager.getAllFunctionSchemas();
  
  // Use LLM to select a function based on user input
  const response = await llmManager.sendMessage([
    {
      role: 'system',
      content: 'Use the available functions to help the user.'
    },
    {
      role: 'user',
      content: 'What\'s the weather like in New York?'
    }
  ], {
    // Include functions in the request
    functions: functionSchemas
  });
  
  // Execute the selected function
  if (response.functionCalls && response.functionCalls.length > 0) {
    const functionCall = response.functionCalls[0];
    const result = await functionManager.executeFunction(
      functionCall.name,
      functionCall.arguments
    );
    
    // Use the result
    console.log('Function result:', result);
  }
}
```

## Best Practices

1. **Function Design**:
   - Keep functions small and focused on a single task
   - Validate inputs thoroughly
   - Handle errors gracefully
   - Document functions clearly

2. **Message Handling**:
   - Define schemas for all message types
   - Always acknowledge received messages
   - Include correlation IDs for request/response patterns

3. **Job Queue**:
   - Set appropriate priorities for time-sensitive tasks
   - Configure reasonable retry strategies
   - Monitor job completion and failure rates

4. **LLM Integration**:
   - Use detailed system prompts to guide the LLM's behavior
   - Implement function calling for structured outputs
   - Balance temperature settings based on task requirements

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.