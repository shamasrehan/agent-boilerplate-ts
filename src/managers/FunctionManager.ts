import { FunctionDefinition, FunctionRegistry, FunctionContext } from '../types';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

/**
 * Function Manager class to manage local and cloud functions
 */
export class FunctionManager {
  private registry: FunctionRegistry = {};
  private apiKeys: Record<string, string[]> = {};

  constructor() {
    this.loadApiKeys();
  }

  /**
   * Load API keys from environment variables
   */
  private loadApiKeys(): void {
    const envVars = process.env;
    
    // Extract API keys from environment variables
    Object.keys(envVars).forEach((key) => {
      if (key.endsWith('_API_KEYS')) {
        try {
          const apiKeyName = key.replace('_API_KEYS', '').toLowerCase();
          const keysValue = envVars[key];
          
          if (keysValue) {
            const keys = JSON.parse(keysValue);
            if (Array.isArray(keys)) {
              this.apiKeys[apiKeyName] = keys;
            }
          }
        } catch (error) {
          console.error(`Error parsing API keys for ${key}:`, error);
        }
      }
    });
  }

  /**
   * Register a new function
   * @param functionDef Function definition to register
   */
  public registerFunction(functionDef: FunctionDefinition): void {
    if (this.registry[functionDef.name]) {
      throw new Error(`Function '${functionDef.name}' is already registered`);
    }
    
    this.registry[functionDef.name] = functionDef;
  }

  /**
   * Register multiple functions at once
   * @param functions Array of function definitions to register
   */
  public registerFunctions(functions: FunctionDefinition[]): void {
    functions.forEach((func) => this.registerFunction(func));
  }

  /**
   * Load functions from a directory
   * @param dirPath Path to directory containing function modules
   */
  public loadFunctionsFromDirectory(dirPath: string): void {
    try {
      const fullPath = path.join(__dirname, '..', dirPath);
      console.log(`Loading functions from directory: ${fullPath}`);
      
      if (!fs.existsSync(fullPath)) {
        console.warn(`Functions directory ${fullPath} does not exist`);
        return;
      }
      
      const files = fs.readdirSync(fullPath);
      
      for (const file of files) {
        // Only load actual implementation files, not type definitions or index
        if ((file.endsWith('.js') || file.endsWith('.ts')) && 
            !file.endsWith('.d.ts') && 
            file !== 'index.js' && 
            file !== 'index.ts') {
          
          const filePath = path.join(fullPath, file);
          console.log(`Attempting to load function from: ${filePath}`);
          
          try {
            // Use a try-catch for each file to avoid one bad file stopping all loading
            // For TypeScript support during development
            let modulePath = path.relative(__dirname, filePath);
            // Ensure path starts with ./ or ../
            if (!modulePath.startsWith('.')) {
              modulePath = `./${modulePath}`;
            }
            
            // Remove file extension for require
            modulePath = modulePath.replace(/\.(js|ts)$/, '');
            
            console.log(`Requiring module from: ${modulePath}`);
            const module = require(modulePath);
            
            if (module.default && typeof module.default === 'function') {
              // If the module exports a registration function
              console.log(`Registering function using default export from ${file}`);
              module.default(this);
            } else if (module.functionDefinition) {
              // If the module exports a function definition directly
              console.log(`Registering function definition from ${file}`);
              this.registerFunction(module.functionDefinition);
            } else {
              console.warn(`Module ${file} does not export a function registration or definition`);
            }
          } catch (error) {
            console.error(`Error loading function from ${filePath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error loading functions from directory ${dirPath}:`, error);
    }
  }

  /**
   * Get a list of all registered function names
   */
  public listFunctions(): string[] {
    return Object.keys(this.registry);
  }

  /**
   * Get a function definition by name
   * @param name Name of the function to retrieve
   */
  public getFunction(name: string): FunctionDefinition | undefined {
    return this.registry[name];
  }

  /**
   * Get all function definitions
   */
  public getAllFunctions(): FunctionDefinition[] {
    return Object.values(this.registry);
  }

  /**
   * Get a specific API key by name and index
   * @param apiKeyName Name of the API key service
   * @param index Index of the specific key to retrieve
   */
  public getApiKey(apiKeyName: string, index: number = 0): string | undefined {
    const normalizedName = apiKeyName.toLowerCase();
    const keys = this.apiKeys[normalizedName] || [];
    
    if (keys.length > 0) {
      return keys[index % keys.length]; // Cycle through keys if index is out of bounds
    }
    return undefined;
  }

  /**
   * Execute a function by name with provided parameters
   * @param name Function name
   * @param params Function parameters
   * @param context Optional execution context
   */
  public async executeFunction(
    name: string,
    params: Record<string, any>,
    context?: FunctionContext
  ): Promise<any> {
    const func = this.registry[name];
    
    if (!func) {
      throw new Error(`Function '${name}' not found`);
    }
    
    // If the function requires an API key, add it to the context
    if (func.apiKeyName && !context?.apiKey) {
      const apiKey = this.getApiKey(func.apiKeyName);
      if (!apiKey) {
        throw new Error(`No API key found for ${func.apiKeyName}`);
      }
      
      context = {
        ...context,
        apiKey
      };
    }
    
    try {
      return await func.handler(params, context);
    } catch (error) {
      console.error(`Error executing function '${name}':`, error);
      throw error;
    }
  }

  /**
   * Get function schema in OpenAI format for AI function calling
   * @param name Name of the function to get schema for
   */
  public getFunctionSchema(name: string): Record<string, any> | undefined {
    const func = this.registry[name];
    
    if (!func) {
      return undefined;
    }
    
    return {
      name: func.name,
      description: func.description,
      parameters: func.parameters
    };
  }

  /**
   * Get all function schemas in OpenAI format
   */
  public getAllFunctionSchemas(): Record<string, any>[] {
    return this.getAllFunctions().map(func => ({
      name: func.name,
      description: func.description,
      parameters: func.parameters
    }));
  }
}

export default FunctionManager;