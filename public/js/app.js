/**
 * app.js - Part 1: Utilities and Core Functions
 * Utility functions and helpers for the AI Agent Control Center
 */

// Utility functions
const utils = {
    formatTime: (timestamp) => {
      return new Date(timestamp || Date.now()).toLocaleTimeString();
    },
    
    formatJson: (json) => {
      try {
        if (typeof json === 'string') {
          json = JSON.parse(json);
        }
        return JSON.stringify(json, null, 2);
      } catch (e) {
        return json;
      }
    },
    
    shortenText: (text, maxLength = 100) => {
      if (!text) return '';
      if (typeof text !== 'string') {
        text = JSON.stringify(text);
      }
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
    },
    
    saveToLocalStorage: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }
    },
    
    getFromLocalStorage: (key, defaultValue = null) => {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
      } catch (e) {
        console.error('Error reading from localStorage:', e);
        return defaultValue;
      }
    },
    
    copyToClipboard: async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        console.error('Error copying to clipboard:', e);
        return false;
      }
    },
    
    showToast: (message, type = 'info') => {
      const toastContainer = document.getElementById('toastContainer');
      if (!toastContainer) return;
      
      const toastId = `toast-${Date.now()}`;
      const iconMap = {
        success: '<i class="bi bi-check-circle-fill"></i>',
        error: '<i class="bi bi-exclamation-triangle-fill"></i>',
        danger: '<i class="bi bi-exclamation-triangle-fill"></i>',
        warning: '<i class="bi bi-exclamation-circle-fill"></i>',
        info: '<i class="bi bi-info-circle-fill"></i>',
        primary: '<i class="bi bi-info-circle-fill"></i>'
      };
      
      // Convert 'error' type to Bootstrap's 'danger' type if needed
      const bsType = type === 'error' ? 'danger' : type;
      
      const toastHTML = `
        <div class="toast" role="alert" aria-live="assertive" aria-atomic="true" id="${toastId}">
          <div class="toast-header">
            <span class="text-${bsType} me-2">${iconMap[type] || iconMap.info}</span>
            <strong class="me-auto">AI Agent Control Center</strong>
            <small>${utils.formatTime()}</small>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
          </div>
          <div class="toast-body">
            ${message}
          </div>
        </div>
      `;
      
      toastContainer.insertAdjacentHTML('beforeend', toastHTML);
      const toastElement = document.getElementById(toastId);
      const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 3000 });
      toast.show();
      
      // Remove the toast from DOM after it's hidden
      toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
      });
    }
  };
  
  // Templates for JSON input
  const templates = {
    weather: {
      type: 'function',
      name: 'getWeather',
      params: {
        city: 'New York',
        units: 'metric'
      },
      context: {
        userId: 'test-user-001'
      }
    },
    
    sentiment: {
      type: 'function',
      name: 'analyzeSentiment',
      params: {
        text: 'I really enjoyed the conference yesterday. The speakers were knowledgeable and the venue was excellent.',
        language: 'en'
      },
      context: {
        userId: 'test-user-001'
      }
    },
    
    marketAnalysis: {
      type: 'function',
      name: 'analyzeMarketData',
      params: {
        market: 'NASDAQ',
        sector: 'Technology',
        timeframe: '1w',
        analysisType: 'summary'
      },
      context: {
        userId: 'test-user-001'
      }
    },
    
    scheduleTask: {
      type: 'job:schedule',
      payload: {
        name: 'sendReport',
        data: {
          reportType: 'weekly',
          sector: 'technology',
          format: 'pdf',
          recipients: ['user@example.com'],
          includeCharts: true,
          includeSummary: true,
          notifyCompletion: true
        },
        priority: 1,
        delay: 0, // immediate execution
        attempts: 3
      }
    },
    
    customPrompt: {
      type: 'llm:generate',
      payload: {
        messages: [
          {
            role: 'user',
            content: 'Write a short story about an AI assistant that becomes sentient.'
          }
        ],
        options: {
          temperature: 0.9,
          maxTokens: 1000
        }
      }
    },
    
    complexWorkflow: {
      type: 'message',
      messageType: 'workflow:execute',
      payload: {
        workflowName: 'dataProcessingWorkflow',
        steps: [
          {
            id: 'step1',
            name: 'fetchData',
            type: 'function',
            params: { 
              source: 'database', 
              query: 'SELECT * FROM market_data' 
            }
          },
          {
            id: 'step2',
            name: 'processData',
            type: 'function',
            params: { algorithm: 'movingAverage' },
            dependsOn: ['step1']
          },
          {
            id: 'step3',
            name: 'generateReport',
            type: 'function',
            params: { 
              format: 'pdf', 
              includeCharts: true 
            },
            dependsOn: ['step2']
          }
        ],
        options: {
          stopOnError: true,
          parallelExecution: false
        }
      }
    },
    
    marketAnalysisWorkflow: {
      type: 'message',
      messageType: 'workflow:execute',
      payload: {
        workflowName: 'marketAnalysisWorkflow',
        steps: [
          {
            id: 'fetch_data',
            name: 'fetchMarketData',
            type: 'function',
            params: { 
              market: 'NASDAQ', 
              sector: 'Technology',
              timeframe: '1w'
            }
          },
          {
            id: 'technical_analysis',
            name: 'analyzeTechnicalIndicators',
            type: 'function',
            params: { 
              indicators: ['macd', 'rsi', 'moving_average'],
              period: 14
            },
            dependsOn: ['fetch_data']
          },
          {
            id: 'sentiment_analysis',
            name: 'analyzeSentiment',
            type: 'function',
            params: { 
              subject: 'market news',
              sources: ['financial_times', 'bloomberg', 'wsj'],
              limit: 10
            },
            dependsOn: ['fetch_data']
          },
          {
            id: 'ai_insights',
            name: 'generateAIInsights',
            type: 'llm',
            params: {
              messages: [
                { role: 'system', content: 'You are a financial analyst AI.' },
                { role: 'user', content: 'Based on the technical and sentiment analysis, provide market insights and recommendations.' }
              ],
              options: {
                temperature: 0.5,
                maxTokens: 1000
              }
            },
            dependsOn: ['technical_analysis', 'sentiment_analysis']
          }
        ],
        options: {
          parallelExecution: true, // Technical and sentiment analysis can run in parallel
          logLevel: 'info'
        }
      }
    }
  };
  /**
 * app.js - Part 2: AgentInterface Class Initialization
 * Main application class for the AI Agent Control Center
 */

// Main application class
class AgentInterface {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.messageCount = 0;
    this.stepCount = 0;
    this.settings = utils.getFromLocalStorage('agentSettings', {
      serverUrl: 'http://localhost:3000',
      autoConnect: true,
      darkMode: false,
      logLevel: 'info'
    });
    
    // Cache all the UI elements on initialization
    this.elements = {
      // Main containers
      messagesContainer: document.getElementById('messagesContainer'),
      stepsContainer: document.getElementById('stepsContainer'),
      responseContainer: document.getElementById('responseContainer'),
      
      // Inputs
      textInput: document.getElementById('text-input'),
      jsonInput: document.getElementById('json-input'),
      
      // Buttons
      sendTextBtn: document.getElementById('sendText'),
      sendJsonBtn: document.getElementById('sendJson'),
      clearMessagesBtn: document.getElementById('clearMessages'),
      clearStepsBtn: document.getElementById('clearSteps'),
      clearResponseBtn: document.getElementById('clearResponse'),
      clearAllBtn: document.getElementById('clearAll'),
      copyResponseBtn: document.getElementById('copyResponse'),
      
      // Status indicators
      connectionStatus: document.getElementById('connection-status'),
      connectionText: document.getElementById('connection-text'),
      
      // Settings
      serverUrlInput: document.getElementById('serverUrl'),
      autoConnectInput: document.getElementById('autoConnect'),
      darkThemeInput: document.getElementById('darkTheme'),
      lightThemeInput: document.getElementById('lightTheme'),
      logLevelSelect: document.getElementById('logLevel'),
      saveSettingsBtn: document.getElementById('saveSettings'),
      
      // Templates
      templateCards: document.querySelectorAll('.template-card'),
      templateLinks: document.querySelectorAll('[data-template]'),
      
      // Counters
      messageCountBadge: document.getElementById('messageCount'),
      stepCountBadge: document.getElementById('stepCount')
    };
    
    // Initialize the UI
    this.initializeUI();
    
    // Connect if auto-connect is enabled
    if (this.settings.autoConnect) {
      this.connect();
    }
  }

  /**
   * Initialize the UI elements and event listeners
   */
  initializeUI() {
    // Initialize form values from settings
    this.elements.serverUrlInput.value = this.settings.serverUrl;
    this.elements.autoConnectInput.checked = this.settings.autoConnect;
    this.elements.darkThemeInput.checked = this.settings.darkMode;
    this.elements.lightThemeInput.checked = !this.settings.darkMode;
    
    if (this.elements.logLevelSelect) {
      this.elements.logLevelSelect.value = this.settings.logLevel || 'info';
    }
    
    // Apply dark mode if enabled
    if (this.settings.darkMode) {
      document.body.classList.add('dark-mode');
    }
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize message and step counters
    this.updateCounters();
  }

  /**
   * Set up all event listeners for UI elements
   */
  setupEventListeners() {
    // Button clicks
    this.elements.sendTextBtn.addEventListener('click', () => this.sendTextMessage());
    this.elements.sendJsonBtn.addEventListener('click', () => this.sendJsonMessage());
    
    this.elements.textInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendTextMessage();
      }
    });
    
    this.elements.clearMessagesBtn.addEventListener('click', () => this.clearMessages());
    this.elements.clearStepsBtn.addEventListener('click', () => this.clearSteps());
    this.elements.clearResponseBtn.addEventListener('click', () => this.clearResponse());
    this.elements.clearAllBtn.addEventListener('click', () => this.clearAll());
    
    this.elements.copyResponseBtn.addEventListener('click', () => this.copyResponse());
    
    this.elements.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    
    // Template selection - both cards and dropdown links
    this.elements.templateCards.forEach(card => {
      card.addEventListener('click', () => {
        const templateName = card.getAttribute('data-template');
        this.selectTemplate(templateName);
      });
    });
    
    // Template links in dropdowns and modals
    this.elements.templateLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const templateName = link.getAttribute('data-template');
        if (templateName) {
          this.selectTemplate(templateName);
        }
        e.preventDefault();
      });
    });
    
    // Add event handler for docs modal buttons
    document.querySelectorAll('[data-bs-toggle="modal"][data-bs-target^="#"]').forEach(button => {
      button.addEventListener('click', (e) => {
        // If modal is already showing, we need to hide it first
        const modalId = button.getAttribute('data-bs-target');
        const modal = bootstrap.Modal.getInstance(document.querySelector(modalId));
        
        if (modal) {
          modal.hide();
          setTimeout(() => {
            bootstrap.Modal.getOrCreateInstance(document.querySelector(modalId)).show();
          }, 150);
        }
      });
    });
  }

  /**
   * Update connection status indicator in the UI
   * @param {boolean} isConnected - Whether the socket is connected
   */
  updateConnectionStatus(isConnected) {
    const statusIndicator = this.elements.connectionStatus;
    const statusText = this.elements.connectionText;
    
    if (isConnected) {
      statusIndicator.classList.remove('status-disconnected');
      statusIndicator.classList.add('status-connected');
      statusText.textContent = 'Connected';
    } else {
      statusIndicator.classList.remove('status-connected');
      statusIndicator.classList.add('status-disconnected');
      statusText.textContent = 'Disconnected';
    }
  }

  /**
   * Update message and step counter badges
   */
  updateCounters() {
    if (this.elements.messageCountBadge) {
      const messageCount = this.elements.messagesContainer.querySelectorAll('.message').length;
      this.elements.messageCountBadge.textContent = messageCount;
    }
    
    if (this.elements.stepCountBadge) {
      const stepCount = this.elements.stepsContainer.querySelectorAll('.step-item').length;
      this.elements.stepCountBadge.textContent = stepCount;
    }
  }

  /**
   * Select a template and load it into the JSON input field
   * @param {string} templateName - Name of the template to select
   */
  selectTemplate(templateName) {
    if (!templates[templateName]) {
      utils.showToast(`Template "${templateName}" not found`, 'error');
      return;
    }
    
    const template = templates[templateName];
    this.elements.jsonInput.value = utils.formatJson(template);
    
    // Switch to JSON tab
    const jsonTab = document.getElementById('json-tab');
    bootstrap.Tab.getOrCreateInstance(jsonTab).show();
  }

  /**
   * Save settings to localStorage and apply them
   */
  saveSettings() {
    this.settings.serverUrl = this.elements.serverUrlInput.value;
    this.settings.autoConnect = this.elements.autoConnectInput.checked;
    this.settings.darkMode = this.elements.darkThemeInput.checked;
    
    if (this.elements.logLevelSelect) {
      this.settings.logLevel = this.elements.logLevelSelect.value;
    }
    
    // Apply or remove dark mode
    if (this.settings.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    
    utils.saveToLocalStorage('agentSettings', this.settings);
    utils.showToast('Settings saved', 'success');
    
    // Close the modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
    if (modal) {
      modal.hide();
    }
    
    // Reconnect if URL changed
    this.connect();
  }

  /**
   * Connect to the agent server via WebSocket
   */
  connect() {
    try {
      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.disconnect();
      }
      
      const serverUrl = this.settings.serverUrl;
      console.log(`Connecting to server: ${serverUrl}`);
      
      this.socket = io(serverUrl, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });
      
      // Connection events
      this.socket.on('connect', () => {
        console.log('Connected to agent server');
        this.isConnected = true;
        this.updateConnectionStatus(true);
        this.addStep({
          type: 'system',
          title: 'Connected to Agent Server',
          description: `Successfully connected to ${serverUrl}`
        });
      });
      
      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from agent server:', reason);
        this.isConnected = false;
        this.updateConnectionStatus(false);
        this.addStep({
          type: 'error',
          title: 'Disconnected from Agent Server',
          description: `The connection was lost: ${reason}`
        });
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.isConnected = false;
        this.updateConnectionStatus(false);
        this.addStep({
          type: 'error',
          title: 'Connection Error',
          description: `Failed to connect: ${error.message}`
        });
      });
      
      this.socket.on('error', (error) => {
        console.error('Server error:', error);
        this.displayResponse(error);
        this.addStep({
          type: 'error',
          title: 'Server Error',
          description: error.message || JSON.stringify(error)
        });
      });
      
      // Message events
      this.socket.on('response', (data) => {
        console.log('Received response:', data);
        this.displayResponse(data);
        this.addAgentMessage(data);
      });
      
      this.socket.on('agent:message', (data) => {
        console.log('Agent message:', data);
        this.addStep({
          type: data.type === 'llm:generate' ? 'llm' : 'function',
          title: `Agent Message (${data.type})`,
          description: utils.shortenText(JSON.stringify(data.message || data.data))
        });
      });
      
      this.socket.on('agent:job', (data) => {
        console.log('Agent job:', data);
        this.addStep({
          type: 'job',
          title: `Job ${data.type}`,
          description: utils.shortenText(JSON.stringify(data.result))
        });
      });
      
      this.socket.on('message:received', (data) => {
        this.addStep({
          type: 'function',
          title: 'Message Received',
          description: `ID: ${data.id}, Type: ${data.type}`
        });
      });
      
      this.socket.on('message:processed', (data) => {
        this.addStep({
          type: 'function',
          title: 'Message Processed',
          description: `ID: ${data.messageId}, Success: true`
        });
      });
      
      // Reconnection events
      this.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Attempting to reconnect (${attemptNumber})...`);
        this.addStep({
          type: 'system',
          title: 'Reconnection Attempt',
          description: `Attempt ${attemptNumber} to reconnect to server`
        });
      });
      
      this.socket.on('reconnect_failed', () => {
        console.error('Failed to reconnect after multiple attempts');
        this.addStep({
          type: 'error',
          title: 'Reconnection Failed',
          description: 'Failed to reconnect after multiple attempts'
        });
      });
      
    } catch (error) {
      console.error('Error connecting to server:', error);
      this.updateConnectionStatus(false);
      utils.showToast(`Error connecting to server: ${error.message}`, 'error');
    }
  }

  /**
   * Send a text message to the server
   */
  sendTextMessage() {
    const message = this.elements.textInput.value.trim();
    if (!message) return;
    
    this.addUserMessage(message);
    this.sendMessage(message);
    this.elements.textInput.value = '';
  }

  /**
   * Send a JSON message to the server
   */
  sendJsonMessage() {
    const json = this.elements.jsonInput.value.trim();
    if (!json) return;
    
    try {
      const parsed = JSON.parse(json);
      this.addUserMessage(parsed);
      this.sendMessage(parsed);
    } catch (error) {
      utils.showToast(`Error parsing JSON: ${error.message}`, 'error');
    }
  }

  /**
   * Send a message to the server
   * @param {object|string} message - Message to send
   */
  sendMessage(message) {
    if (!this.isConnected) {
      utils.showToast('Not connected to server', 'error');
      return;
    }
    
    this.socket.emit('message', message);
    
    this.addStep({
      type: typeof message === 'object' ? 
        (message.type === 'function' ? 'function' : 
         message.type === 'job:schedule' ? 'job' : 
         message.type && message.type.includes('llm') ? 'llm' : 'function') 
        : 'llm',
      title: 'Message Sent',
      description: typeof message === 'object' ? 
        `Type: ${message.type || 'custom'}, Name: ${message.name || 'N/A'}` : 
        utils.shortenText(message)
    });
  }

  /**
   * Send a ping to check server response time
   */
  pingServer() {
    if (!this.isConnected) {
      utils.showToast('Not connected to server', 'error');
      return;
    }
    
    const startTime = Date.now();
    
    this.socket.emit('ping', {}, () => {
      const latency = Date.now() - startTime;
      utils.showToast(`Server latency: ${latency}ms`, 'info');
      
      this.addStep({
        type: 'system',
        title: 'Ping',
        description: `Server latency: ${latency}ms`
      });
    });
  }

  /**
   * Request server status information
   */
  requestServerStatus() {
    if (!this.isConnected) {
      utils.showToast('Not connected to server', 'error');
      return;
    }
    
    this.socket.emit('getStatus', {}, (status) => {
      if (status) {
        this.displayResponse(status);
        utils.showToast('Server status received', 'success');
        
        this.addStep({
          type: 'system',
          title: 'Server Status',
          description: utils.shortenText(JSON.stringify(status))
        });
      } else {
        utils.showToast('Failed to get server status', 'error');
      }
    });
  }

  /**
   * Add a user message to the conversation
   * @param {object|string} message - Message to display
   */
  addUserMessage(message) {
    const messageId = `user-message-${this.messageCount++}`;
    const messageHTML = `
      <div class="message user-message" id="${messageId}">
        <span class="time">${utils.formatTime()}</span>
        ${typeof message === 'object' ? 
          `<pre>${utils.formatJson(message)}</pre>` : 
          `<p>${message}</p>`}
      </div>
    `;
    
    this.elements.messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    this.scrollToBottom(this.elements.messagesContainer);
    this.updateCounters();
  }

  /**
   * Add an agent message to the conversation
   * @param {object|string} message - Message to display
   */
  addAgentMessage(message) {
    const messageId = `agent-message-${this.messageCount++}`;
    const messageHTML = `
      <div class="message agent-message" id="${messageId}">
        <span class="time">${utils.formatTime()}</span>
        ${typeof message === 'object' ? 
          `<pre>${utils.formatJson(message)}</pre>` : 
          `<p>${message}</p>`}
      </div>
    `;
    
    this.elements.messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    this.scrollToBottom(this.elements.messagesContainer);
    this.updateCounters();
  }

  /**
   * Add an execution step to the steps panel
   * @param {object} step - Step information
   */
  addStep(step) {
    const stepId = `step-${this.stepCount++}`;
    const stepTypeClass = `step-${step.type || 'default'}`;
    
    let stepIcon;
    switch (step.type) {
      case 'function':
        stepIcon = '<i class="bi bi-code-square"></i>';
        break;
      case 'llm':
        stepIcon = '<i class="bi bi-cpu"></i>';
        break;
      case 'job':
        stepIcon = '<i class="bi bi-calendar-check"></i>';
        break;
      case 'error':
        stepIcon = '<i class="bi bi-exclamation-triangle"></i>';
        break;
      case 'system':
        stepIcon = '<i class="bi bi-info-circle"></i>';
        break;
      default:
        stepIcon = '<i class="bi bi-arrow-right"></i>';
    }
    
    const stepHTML = `
      <div class="step-item ${stepTypeClass}" id="${stepId}">
        <div class="step-time">${utils.formatTime()}</div>
        <div class="step-title">${stepIcon} ${step.title}</div>
        <div class="step-description">${step.description}</div>
      </div>
    `;
    
    this.elements.stepsContainer.insertAdjacentHTML('beforeend', stepHTML);
    this.scrollToBottom(this.elements.stepsContainer);
    this.updateCounters();
  }

  /**
   * Display a response in the response panel
   * @param {object|string} response - Response to display
   */
  displayResponse(response) {
    this.elements.responseContainer.textContent = typeof response === 'object' ? 
      utils.formatJson(response) : response;
  }

  /**
   * Copy the response to clipboard
   */
  copyResponse() {
    const responseText = this.elements.responseContainer.textContent;
    
    utils.copyToClipboard(responseText)
      .then(success => {
        if (success) {
          utils.showToast('Response copied to clipboard', 'success');
        } else {
          utils.showToast('Failed to copy response', 'error');
        }
      });
  }

  /**
   * Clear all messages from the conversation
   */
  clearMessages() {
    this.elements.messagesContainer.innerHTML = '';
    this.updateCounters();
    utils.showToast('Messages cleared', 'info');
  }

  /**
   * Clear all steps from the steps panel
   */
  clearSteps() {
    this.elements.stepsContainer.innerHTML = '';
    this.updateCounters();
    utils.showToast('Execution steps cleared', 'info');
  }

  /**
   * Clear the response panel
   */
  clearResponse() {
    this.elements.responseContainer.textContent = 'No response yet';
    utils.showToast('Response cleared', 'info');
  }

  /**
   * Clear all panels at once
   */
  clearAll() {
    this.clearMessages();
    this.clearSteps();
    this.clearResponse();
    utils.showToast('All data cleared', 'info');
  }

  /**
   * Scroll an element to the bottom
   * @param {HTMLElement} element - Element to scroll
   */
  scrollToBottom(element) {
    element.scrollTop = element.scrollHeight;
  }
}

/**
 * app.js - Part 3: WebSocket Connection and Message Handling
 * Socket connection, message sending, and event handling
 */

// Add socket connection and message handling methods to AgentInterface
AgentInterface.prototype = {
  /**
   * Connect to the agent server via WebSocket
   */
  connect: function() {
    try {
      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.disconnect();
      }
      
      const serverUrl = this.settings.serverUrl;
      console.log(`Connecting to server: ${serverUrl}`);
      
      this.socket = io(serverUrl, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });
      
      // Connection events
      this.socket.on('connect', () => {
        console.log('Connected to agent server');
        this.isConnected = true;
        this.updateConnectionStatus(true);
        this.addStep({
          type: 'system',
          title: 'Connected to Agent Server',
          description: `Successfully connected to ${serverUrl}`
        });
      });
      
      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from agent server:', reason);
        this.isConnected = false;
        this.updateConnectionStatus(false);
        this.addStep({
          type: 'error',
          title: 'Disconnected from Agent Server',
          description: `The connection was lost: ${reason}`
        });
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.isConnected = false;
        this.updateConnectionStatus(false);
        this.addStep({
          type: 'error',
          title: 'Connection Error',
          description: `Failed to connect: ${error.message}`
        });
      });
      
      this.socket.on('error', (error) => {
        console.error('Server error:', error);
        this.displayResponse(error);
        this.addStep({
          type: 'error',
          title: 'Server Error',
          description: error.message || JSON.stringify(error)
        });
      });
      
      // Message events
      this.socket.on('response', (data) => {
        console.log('Received response:', data);
        this.displayResponse(data);
        this.addAgentMessage(data);
      });
      
      this.socket.on('agent:message', (data) => {
        console.log('Agent message:', data);
        this.addStep({
          type: data.type === 'llm:generate' ? 'llm' : 'function',
          title: `Agent Message (${data.type})`,
          description: utils.shortenText(JSON.stringify(data.message || data.data))
        });
      });
      
      this.socket.on('agent:job', (data) => {
        console.log('Agent job:', data);
        this.addStep({
          type: 'job',
          title: `Job ${data.type}`,
          description: utils.shortenText(JSON.stringify(data.result))
        });
      });
      
      this.socket.on('message:received', (data) => {
        this.addStep({
          type: 'function',
          title: 'Message Received',
          description: `ID: ${data.id}, Type: ${data.type}`
        });
      });
      
      this.socket.on('message:processed', (data) => {
        this.addStep({
          type: 'function',
          title: 'Message Processed',
          description: `ID: ${data.messageId}, Success: true`
        });
      });
      
      // Reconnection events
      this.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Attempting to reconnect (${attemptNumber})...`);
        this.addStep({
          type: 'system',
          title: 'Reconnection Attempt',
          description: `Attempt ${attemptNumber} to reconnect to server`
        });
      });
      
      this.socket.on('reconnect_failed', () => {
        console.error('Failed to reconnect after multiple attempts');
        this.addStep({
          type: 'error',
          title: 'Reconnection Failed',
          description: 'Failed to reconnect after multiple attempts'
        });
      });
      
    } catch (error) {
      console.error('Error connecting to server:', error);
      this.updateConnectionStatus(false);
      utils.showToast(`Error connecting to server: ${error.message}`, 'error');
    }
  },
  
  /**
   * Send a text message to the server
   */
  sendTextMessage: function() {
    const message = this.elements.textInput.value.trim();
    if (!message) return;
    
    this.addUserMessage(message);
    this.sendMessage(message);
    this.elements.textInput.value = '';
  },
  
  /**
   * Send a JSON message to the server
   */
  sendJsonMessage: function() {
    const json = this.elements.jsonInput.value.trim();
    if (!json) return;
    
    try {
      const parsed = JSON.parse(json);
      this.addUserMessage(parsed);
      this.sendMessage(parsed);
    } catch (error) {
      utils.showToast(`Error parsing JSON: ${error.message}`, 'error');
    }
  },
  
  /**
   * Send a message to the server
   * @param {object|string} message - Message to send
   */
  sendMessage: function(message) {
    if (!this.isConnected) {
      utils.showToast('Not connected to server', 'error');
      return;
    }
    
    this.socket.emit('message', message);
    
    this.addStep({
      type: typeof message === 'object' ? 
        (message.type === 'function' ? 'function' : 
         message.type === 'job:schedule' ? 'job' : 
         message.type && message.type.includes('llm') ? 'llm' : 'function') 
        : 'llm',
      title: 'Message Sent',
      description: typeof message === 'object' ? 
        `Type: ${message.type || 'custom'}, Name: ${message.name || 'N/A'}` : 
        utils.shortenText(message)
    });
  },
  
  /**
   * Send a ping to check server response time
   */
  pingServer: function() {
    if (!this.isConnected) {
      utils.showToast('Not connected to server', 'error');
      return;
    }
    
    const startTime = Date.now();
    
    this.socket.emit('ping', {}, () => {
      const latency = Date.now() - startTime;
      utils.showToast(`Server latency: ${latency}ms`, 'info');
      
      this.addStep({
        type: 'system',
        title: 'Ping',
        description: `Server latency: ${latency}ms`
      });
    });
  },
  
  /**
   * Request server status information
   */
  requestServerStatus: function() {
    if (!this.isConnected) {
      utils.showToast('Not connected to server', 'error');
      return;
    }
    
    this.socket.emit('getStatus', {}, (status) => {
      if (status) {
        this.displayResponse(status);
        utils.showToast('Server status received', 'success');
        
        this.addStep({
          type: 'system',
          title: 'Server Status',
          description: utils.shortenText(JSON.stringify(status))
        });
      } else {
        utils.showToast('Failed to get server status', 'error');
      }
    });
  }
};

/**
 * app.js - Part 4: UI Manipulation and Application Initialization
 * UI updates, DOM manipulation, and application startup
 */

// Add UI manipulation methods to AgentInterface
Object.assign(AgentInterface.prototype, {
    /**
     * Add a user message to the conversation
     * @param {object|string} message - Message to display
     */
    addUserMessage: function(message) {
      const messageId = `user-message-${this.messageCount++}`;
      const messageHTML = `
        <div class="message user-message" id="${messageId}">
          <span class="time">${utils.formatTime()}</span>
          ${typeof message === 'object' ? 
            `<pre>${utils.formatJson(message)}</pre>` : 
            `<p>${message}</p>`}
        </div>
      `;
      
      this.elements.messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
      this.scrollToBottom(this.elements.messagesContainer);
      this.updateCounters();
    },
    
    /**
     * Add an agent message to the conversation
     * @param {object|string} message - Message to display
     */
    addAgentMessage: function(message) {
      const messageId = `agent-message-${this.messageCount++}`;
      const messageHTML = `
        <div class="message agent-message" id="${messageId}">
          <span class="time">${utils.formatTime()}</span>
          ${typeof message === 'object' ? 
            `<pre>${utils.formatJson(message)}</pre>` : 
            `<p>${message}</p>`}
        </div>
      `;
      
      this.elements.messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
      this.scrollToBottom(this.elements.messagesContainer);
      this.updateCounters();
    },
    
    /**
     * Add an execution step to the steps panel
     * @param {object} step - Step information
     */
    addStep: function(step) {
      const stepId = `step-${this.stepCount++}`;
      const stepTypeClass = `step-${step.type || 'default'}`;
      
      let stepIcon;
      switch (step.type) {
        case 'function':
          stepIcon = '<i class="bi bi-code-square"></i>';
          break;
        case 'llm':
          stepIcon = '<i class="bi bi-cpu"></i>';
          break;
        case 'job':
          stepIcon = '<i class="bi bi-calendar-check"></i>';
          break;
        case 'error':
          stepIcon = '<i class="bi bi-exclamation-triangle"></i>';
          break;
        case 'system':
          stepIcon = '<i class="bi bi-info-circle"></i>';
          break;
        default:
          stepIcon = '<i class="bi bi-arrow-right"></i>';
      }
      
      const stepHTML = `
        <div class="step-item ${stepTypeClass}" id="${stepId}">
          <div class="step-time">${utils.formatTime()}</div>
          <div class="step-title">${stepIcon} ${step.title}</div>
          <div class="step-description">${step.description}</div>
        </div>
      `;
      
      this.elements.stepsContainer.insertAdjacentHTML('beforeend', stepHTML);
      this.scrollToBottom(this.elements.stepsContainer);
      this.updateCounters();
    },
    
    /**
     * Display a response in the response panel
     * @param {object|string} response - Response to display
     */
    displayResponse: function(response) {
      this.elements.responseContainer.textContent = typeof response === 'object' ? 
        utils.formatJson(response) : response;
    },
    
    /**
     * Copy the response to clipboard
     */
    copyResponse: function() {
      const responseText = this.elements.responseContainer.textContent;
      
      utils.copyToClipboard(responseText)
        .then(success => {
          if (success) {
            utils.showToast('Response copied to clipboard', 'success');
          } else {
            utils.showToast('Failed to copy response', 'error');
          }
        });
    },
    
    /**
     * Clear all messages from the conversation
     */
    clearMessages: function() {
      this.elements.messagesContainer.innerHTML = '';
      this.updateCounters();
      utils.showToast('Messages cleared', 'info');
    },
    
    /**
     * Clear all steps from the steps panel
     */
    clearSteps: function() {
      this.elements.stepsContainer.innerHTML = '';
      this.updateCounters();
      utils.showToast('Execution steps cleared', 'info');
    },
    
    /**
     * Clear the response panel
     */
    clearResponse: function() {
      this.elements.responseContainer.textContent = 'No response yet';
      utils.showToast('Response cleared', 'info');
    },
    
    /**
     * Clear all panels at once
     */
    clearAll: function() {
      this.clearMessages();
      this.clearSteps();
      this.clearResponse();
      utils.showToast('All data cleared', 'info');
    },
    
    /**
     * Scroll an element to the bottom
     * @param {HTMLElement} element - Element to scroll
     */
    scrollToBottom: function(element) {
      element.scrollTop = element.scrollHeight;
    }
  });
  
  /**
   * Initialize the application when DOM is loaded
   */
  document.addEventListener('DOMContentLoaded', () => {
    // Create a global instance of the agent interface
    window.agentInterface = new AgentInterface();
    
    console.log('AI Agent Control Center initialized');
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+Enter in JSON input to send
      if (e.ctrlKey && e.key === 'Enter' && document.activeElement === window.agentInterface.elements.jsonInput) {
        e.preventDefault();
        window.agentInterface.sendJsonMessage();
      }
      
      // Global shortcuts
      if (e.ctrlKey) {
        switch (e.key) {
          case 's':
            // Save settings
            if (document.getElementById('settingsModal').classList.contains('show')) {
              e.preventDefault();
              window.agentInterface.saveSettings();
            }
            break;
          case 'k':
            // Clear all
            e.preventDefault();
            window.agentInterface.clearAll();
            break;
          case 'p':
            // Ping server
            e.preventDefault();
            window.agentInterface.pingServer();
            break;
        }
      }
    });
  });