const amqp = require('amqplib');

async function testConnection() {
  try {
    console.log('Attempting to connect to RabbitMQ...');
    const connection = await amqp.connect('amqp://guest:guest@127.0.0.1:5672');
    console.log('Successfully connected to RabbitMQ!');
    
    const channel = await connection.createChannel();
    console.log('Successfully created channel!');
    
    await channel.close();
    await connection.close();
    console.log('Connection closed successfully');
  } catch (error) {
    console.error('Failed to connect:', error);
  }
}

testConnection();