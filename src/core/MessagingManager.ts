import amqp from 'amqplib';
import { 
  MessageConfig, 
  Message, 
  IncomingMessage, 
  OutgoingMessage, 
  MessageSchema 
} from '../types';
import { Validator } from 'jsonschema';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

/**
 * Message Manager for handling communication with external systems via RabbitMQ
 */
export class MessagingManager extends EventEmitter {
  private connection: any = null;
  private channel: any = null;
  private config: MessageConfig;
  private incomingSchemas: Map<string, MessageSchema> = new Map();
  private outgoingSchemas: Map<string, MessageSchema> = new Map();
  private validator: Validator;
  private isConnected: boolean = false;

  /**
   * Creates a new MessagingManager instance
   * @param config The messaging configuration
   */
  constructor(config: MessageConfig) {
    super();
    this.config = config;
    this.validator = new Validator();
  }

  /**
   * Initialize the connection to RabbitMQ
   * @param url The RabbitMQ connection URL
   */
  public async initialize(url: string): Promise<void> {
    try {
      console.log(`Attempting to connect to RabbitMQ with URL: ${url}`);
      this.connection = await amqp.connect(url);
      console.log('Successfully connected to RabbitMQ');
      
      console.log('Creating confirm channel...');
      this.channel = await this.connection.createConfirmChannel();
      console.log('Confirm channel created successfully');
      
      // Ensure queues exist
      console.log('Asserting queues...');
      await this.channel.assertQueue(this.config.incomingQueue, { durable: true });
      await this.channel.assertQueue(this.config.outgoingQueue, { durable: true });
      await this.channel.assertQueue(this.config.acknowledgmentQueue, { durable: true });
      console.log('Queues asserted successfully');

      // If exchange is configured, assert it
      if (this.config.exchange) {
        console.log('Asserting exchange...');
        await this.channel.assertExchange(this.config.exchange, 'topic', { durable: true });
        await this.channel.bindQueue(this.config.incomingQueue, this.config.exchange, 'incoming.*');
        await this.channel.bindQueue(this.config.outgoingQueue, this.config.exchange, 'outgoing.*');
        await this.channel.bindQueue(this.config.acknowledgmentQueue, this.config.exchange, 'acknowledgment.*');
        console.log('Exchange and bindings created successfully');
      }

      // Set up consumer for incoming messages
      console.log('Setting up consumer...');
      this.setupConsumer();
      
      this.isConnected = true;
      this.emit('connected');
      console.log(`Connected to RabbitMQ and initialized queues`);
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Register a schema for validating incoming messages
   * @param schema The schema to register
   */
  public registerIncomingSchema(schema: MessageSchema): void {
    this.incomingSchemas.set(schema.name, schema);
  }

  /**
   * Register a schema for validating outgoing messages
   * @param schema The schema to register
   */
  public registerOutgoingSchema(schema: MessageSchema): void {
    this.outgoingSchemas.set(schema.name, schema);
  }

  /**
   * Consume messages from the incoming queue
   */
  private setupConsumer(): void {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    this.channel.consume(
      this.config.incomingQueue,
      async (msg: amqp.ConsumeMessage | null) => {
        if (!msg) return;
        
        try {
          // Parse message
          const messageContent = JSON.parse(msg.content.toString());
          const message: IncomingMessage = {
            id: messageContent.id || uuidv4(),
            type: messageContent.type,
            timestamp: messageContent.timestamp || Date.now(),
            payload: messageContent.payload,
            metadata: messageContent.metadata,
            replyTo: msg.properties.replyTo
          };

          // Validate message if schema exists
          const schema = this.incomingSchemas.get(message.type);
          if (schema) {
            const validationResult = this.validator.validate(message.payload, schema.schema);
            if (!validationResult.valid) {
              console.error(`Invalid message format for type ${message.type}:`, validationResult.errors);
              this.sendAcknowledgment(message.id, 'error', {
                error: 'Invalid message format',
                details: validationResult.errors
              });
              this.channel.ack(msg);
              return;
            }
          }

          // Acknowledge receipt of message to RabbitMQ
          this.channel.ack(msg);
          
          // Send acknowledgment that we received the message
          await this.sendAcknowledgment(message.id, 'success', { received: true });

          // Emit message for processing
          this.emit('message', message);
        } catch (error) {
          console.error('Error processing message:', error);
          this.channel.nack(msg, false, false); // Don't requeue the message if it's malformed
          
          // Try to send an acknowledgment if we have enough info
          try {
            const content = msg.content.toString();
            const parsed = JSON.parse(content);
            if (parsed.id) {
              await this.sendAcknowledgment(parsed.id, 'error', {
                error: 'Failed to process message',
                details: error instanceof Error ? error.message : String(error)
              });
            }
          } catch (ackError) {
            console.error('Could not send error acknowledgment:', ackError);
          }
        }
      },
      { noAck: false }
    );
  }

  /**
   * Send a message to the outgoing queue
   * @param type Message type
   * @param payload Message payload
   * @param correlationId Optional correlation ID to link with a received message
   * @param metadata Optional metadata to include with the message
   */
  public async sendMessage(
    type: string,
    payload: any,
    correlationId?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (!this.channel || !this.isConnected) {
      throw new Error('Not connected to message broker');
    }

    // Validate outgoing message if schema exists
    const schema = this.outgoingSchemas.get(type);
    if (schema) {
      const validationResult = this.validator.validate(payload, schema.schema);
      if (!validationResult.valid) {
        throw new Error(`Invalid outgoing message format for type ${type}: ${validationResult.errors}`);
      }
    }

    const message: OutgoingMessage = {
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      payload,
      correlationId,
      status: 'success',
      metadata
    };

    // Publish message to outgoing queue
    this.channel.sendToQueue(
      this.config.outgoingQueue,
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,
        correlationId: correlationId || message.id
      }
    );

    return message.id;
  }

  /**
   * Send an acknowledgment for a received message
   * @param messageId The ID of the message being acknowledged
   * @param status The status of the acknowledgment
   * @param details Any additional details about the acknowledgment
   */
  public async sendAcknowledgment(
    messageId: string,
    status: 'success' | 'error' | 'pending',
    details?: any
  ): Promise<void> {
    if (!this.channel || !this.isConnected) {
      throw new Error('Not connected to message broker');
    }

    const acknowledgment: OutgoingMessage = {
      id: uuidv4(),
      type: 'acknowledgment',
      timestamp: Date.now(),
      correlationId: messageId,
      status,
      payload: details || {}
    };

    this.channel.sendToQueue(
      this.config.acknowledgmentQueue,
      Buffer.from(JSON.stringify(acknowledgment)),
      {
        persistent: true,
        correlationId: messageId
      }
    );
  }

  /**
   * Close the connection to RabbitMQ
   */
  public async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
    this.isConnected = false;
    this.emit('disconnected');
  }
}

export default MessagingManager;