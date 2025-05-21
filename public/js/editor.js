/**
 * Monaco Editor initialization and management
 */
let editor; // Global editor reference

// Initialize Monaco Editor
function initEditor() {
  require.config({
    paths: {
      'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs'
    }
  });

  require(['vs/editor/editor.main'], function() {
    // Create editor instance
    editor = monaco.editor.create(document.getElementById('json-editor'), {
      value: JSON.stringify(messageTemplates.default, null, 2),
      language: 'json',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: {
        enabled: false
      },
      scrollBeyondLastLine: false,
      fontSize: 13,
      tabSize: 2
    });

    // Handle template selection changes
    const templateSelect = document.getElementById('template-select');
    templateSelect.addEventListener('change', () => {
      const selectedTemplate = templateSelect.value;
      if (messageTemplates[selectedTemplate]) {
        setEditorContent(messageTemplates[selectedTemplate]);
      }
    });

    // Set up validation button
    const validateBtn = document.getElementById('validate-btn');
    validateBtn.addEventListener('click', validateJson);

    // Set up the editor for automatic validation
    editor.onDidChangeModelContent(() => {
      // Clear any decorations
      const model = editor.getModel();
      monaco.editor.setModelMarkers(model, 'owner', []);
    });
  });
}

// Set editor content from an object
function setEditorContent(jsonObj) {
  if (editor) {
    editor.setValue(JSON.stringify(jsonObj, null, 2));
  }
}

// Get editor content as parsed JSON
function getEditorContent() {
  if (!editor) return null;
  
  try {
    const content = editor.getValue();
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

// Validate JSON in editor
function validateJson() {
  if (!editor) return false;
  
  const model = editor.getModel();
  const content = editor.getValue();
  
  try {
    JSON.parse(content);
    
    // Clear any decorations
    monaco.editor.setModelMarkers(model, 'owner', []);
    
    // Show success in logs
    addLogEntry('Validation successful: JSON is valid', 'success');
    return true;
  } catch (e) {
    // Get error details
    const match = e.message.match(/at position (\d+)/);
    if (match) {
      const position = parseInt(match[1], 10);
      const textUntilErrorPosition = content.substring(0, position);
      const lineNumber = (textUntilErrorPosition.match(/\n/g) || []).length + 1;
      const lastLineBreakIndex = textUntilErrorPosition.lastIndexOf('\n');
      const column = lastLineBreakIndex === -1 ? position + 1 : position - lastLineBreakIndex;
      
      // Mark the error in editor
      monaco.editor.setModelMarkers(model, 'owner', [{
        severity: monaco.MarkerSeverity.Error,
        message: e.message,
        startLineNumber: lineNumber,
        startColumn: column,
        endLineNumber: lineNumber,
        endColumn: column + 1
      }]);
    }
    
    // Show error in logs
    addLogEntry(`Validation failed: ${e.message}`, 'error');
    return false;
  }
}

// Initialize the editor on document load
document.addEventListener('DOMContentLoaded', initEditor);