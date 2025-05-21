/**
 * Socket.IO client for connecting to the AI Agent server
 */
let socket;
let isConnected = false;

// Initialize socket connection
function initSocketConnection() {
  // Initialize Socket.IO connection
  socket = io();
  
  // Connection status indicator elements
  const statusIndicator = document.getElementById('status-indicator');
  const connectionText = document.getElementById('connection-text');
  
  // Connection established
  socket.on('connect', () => {
    isConnected = true;
    statusIndicator.className = 'status-indicator connected';
    connectionText.textContent = 'Connected';
    addLogEntry('Connected to AI Agent server', 'info');
  });
  
  // Connection lost
  socket.on('disconnect', () => {
    isConnected = false;
    statusIndicator.className = 'status-indicator';
    connectionText.textContent = 'Disconnected';
    addLogEntry('Disconnected from AI Agent server', 'warning');
  });
  
  // Connection error
  socket.on('connect_error', (error) => {
    isConnected = false;
    statusIndicator.className = 'status-indicator error';
    connectionText.textContent = 'Connection Error';
    addLogEntry(`Connection error: ${error.message}`, 'error');
  });
  
  // Handle agent responses
  socket.on('response', handleAgentResponse);
  
  // Handle errors from the agent
  socket.on('error', (error) => {
    addLogEntry(`Agent error: ${error.message}`, 'error');
    showErrorResponse(error);
  });
  
  // Handle agent message events
  socket.on('agent:message', handleAgentMessage);
  
  // Handle agent job events
  socket.on('agent:job', handleAgentJob);
  
  // Set up the send button event
  const sendBtn = document.getElementById('send-btn');
  sendBtn.addEventListener('click', sendMessage);
}

// Send message to the agent
function sendMessage() {
  if (!isConnected) {
    addLogEntry('Cannot send message: Not connected to server', 'error');
    return;
  }
  
  // Validate JSON first
  if (!validateJson()) return;
  
  // Get message content
  const message = getEditorContent();
  if (!message) {
    addLogEntry('Cannot send message: Invalid JSON', 'error');
    return;
  }
  
  // Send the message
  socket.emit('message', message);
  
  // Log the sent message
  addLogEntry('Message sent to AI Agent', 'info');
  addLogEntry(JSON.stringify(message, null, 2), 'info');
  
  // Show loading state
  const responseContainer = document.getElementById('response-container');
  responseContainer.innerHTML = '<div class="loading-state">Processing request...</div>';
}

// Handle agent responses
function handleAgentResponse(response) {
  addLogEntry('Received response from AI Agent', 'success');
  
  // Format the response for display
  let formattedResponse;
  if (typeof response === 'string') {
    try {
      // Attempt to parse as JSON
      const parsedResponse = JSON.parse(response);
      formattedResponse = formatJsonResponse(parsedResponse);
    } catch (e) {
      // Display as plain text
      formattedResponse = response;
    }
  } else {
    // Format object as JSON
    formattedResponse = formatJsonResponse(response);
  }
  
  // Update response container
  const responseContainer = document.getElementById('response-container');
  responseContainer.innerHTML = formattedResponse;
  
  // Log the response
  if (typeof response === 'object') {
    addLogEntry(JSON.stringify(response, null, 2), 'success');
  } else {
    addLogEntry(response, 'success');
  }
}

// Handle error responses
function showErrorResponse(error) {
  const responseContainer = document.getElementById('response-container');
  responseContainer.innerHTML = `<div class="error-state">
    <h3>Error</h3>
    <p>${error.message || 'Unknown error occurred'}</p>
  </div>`;
}

// Handle agent messages
function handleAgentMessage(data) {
  const { type, message, data: messageData } = data;
  
  switch (type) {
    case 'received':
      addLogEntry(`Agent received message: ${message.id} (${message.type})`, 'info');
      break;
    case 'processed':
      addLogEntry(`Agent processed message: ${messageData.messageId}`, 'success');
      break;
    default:
      addLogEntry(`Agent message event: ${type}`, 'info');
  }
}

// Handle agent job events
function handleAgentJob(data) {
  const { type, result } = data;
  
  switch (type) {
    case 'completed':
      addLogEntry(`Job completed: ${result.jobId}`, 'success');
      addLogEntry(`Duration: ${result.duration}ms`, 'info');
      break;
    case 'failed':
      addLogEntry(`Job failed: ${result.jobId}`, 'error');
      addLogEntry(`Error: ${result.error?.message || 'Unknown error'}`, 'error');
      break;
    default:
      addLogEntry(`Job event: ${type}`, 'info');
  }
}

// Format JSON response with syntax highlighting
function formatJsonResponse(jsonObj) {
  // Create a response based on the template if it's not in the expected format
  if (jsonObj && typeof jsonObj === 'object' && !jsonObj.intent && !jsonObj.action) {
    // Clone the response template
    const response = JSON.parse(JSON.stringify(responseTemplate));
    
    // Add the data to the context
    response.entity.context.data = jsonObj;
    
    jsonObj = response;
  }
  
  // Stringify with indentation
  const jsonStr = JSON.stringify(jsonObj, null, 2);
  
  // Apply syntax highlighting
  return jsonStr.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

// Initialize the socket connection on document load
document.addEventListener('DOMContentLoaded', initSocketConnection);