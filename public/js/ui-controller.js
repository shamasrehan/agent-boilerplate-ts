/**
 * UI Controller for the AI Agent Dashboard
 */

// Log entry max count
const MAX_LOG_ENTRIES = 500;

// Initialize UI components
function initUI() {
  // Set up clear logs button
  const clearLogsBtn = document.getElementById('clear-logs-btn');
  clearLogsBtn.addEventListener('click', clearLogs);
  
  // Add initial log
  addLogEntry('AI Agent Dashboard initialized', 'info');
}

// Add a log entry to the logs container
function addLogEntry(message, type = 'info') {
  const logsContainer = document.getElementById('logs-container');
  
  // Create log entry DOM elements
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  
  // Add timestamp
  const timestamp = new Date();
  const timeStr = timestamp.toLocaleTimeString();
  const logTime = document.createElement('span');
  logTime.className = 'log-time';
  logTime.textContent = timeStr;
  
  // Add log type badge
  const logType = document.createElement('span');
  logType.className = `log-type log-type-${type}`;
  logType.textContent = type;
  
  // Add message
  const logMessage = document.createElement('span');
  logMessage.className = 'log-message';
  
  // Check if message is JSON-like
  if (typeof message === 'string' && message.trim().startsWith('{') && message.trim().endsWith('}')) {
    try {
      // Format it as JSON with syntax highlighting
      const jsonObj = JSON.parse(message);
      const jsonStr = JSON.stringify(jsonObj, null, 2);
      
      logMessage.innerHTML = jsonStr.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
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
    } catch (e) {
      // Not valid JSON, display as-is
      logMessage.textContent = message;
    }
  } else {
    logMessage.textContent = message;
  }
  
  // Assemble the log entry
  logEntry.appendChild(logTime);
  logEntry.appendChild(logType);
  logEntry.appendChild(logMessage);
  
  // Add to logs container
  logsContainer.appendChild(logEntry);
  
  // Auto-scroll to bottom
  logsContainer.scrollTop = logsContainer.scrollHeight;
  
  // Remove old logs if too many
  const logEntries = logsContainer.querySelectorAll('.log-entry');
  if (logEntries.length > MAX_LOG_ENTRIES) {
    for (let i = 0; i < logEntries.length - MAX_LOG_ENTRIES; i++) {
      logsContainer.removeChild(logEntries[i]);
    }
  }
}

// Clear all logs
function clearLogs() {
  const logsContainer = document.getElementById('logs-container');
  logsContainer.innerHTML = '';
  addLogEntry('Logs cleared', 'info');
}

// Format file size
function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + ' B';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + ' KB';
  } else if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  } else {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
}

// Format duration in milliseconds
function formatDuration(milliseconds) {
  if (milliseconds < 1000) {
    return milliseconds + 'ms';
  } else if (milliseconds < 60000) {
    return (milliseconds / 1000).toFixed(2) + 's';
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(2);
    return minutes + 'm ' + seconds + 's';
  }
}

// Initialize UI on document load
document.addEventListener('DOMContentLoaded', initUI);