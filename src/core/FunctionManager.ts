import { FunctionDefinition, FunctionRegistry, FunctionContext } from '../types';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

/**
 * Function Manager class to manage local and cloud functions
 * Provides mechanisms to register, execute, and manage API keys for functions
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
          console.error(`Error parsing API keys for ${key}: ${error}`);
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
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        if (file.endsWith('.js')) {  // Only load .js files
          const filePath = path.join(dirPath, file);
          // Using dynamic import to load the modules
          import(filePath).then((module) => {
            if (module.default && typeof module.default === 'function') {
              // If the module exports a registration function
              module.default(this);
            } else if (module.functionDefinition) {
              // If the module exports a function definition directly
              this.registerFunction(module.functionDefinition);
            }
          }).catch((error) => {
            console.error(`Error loading function from ${filePath}: ${error}`);
          });
        }
      }
    } catch (error) {
      console.error(`Error loading functions from directory ${dirPath}: ${error}`);
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
   * Remove a function from the registry
   * @param name Name of the function to remove
   */
  public unregisterFunction(name: string): boolean {
    if (this.registry[name]) {
      delete this.registry[name];
      return true;
    }
    return false;
  }

  /**
   * Get available API keys for a specific service
   * @param apiKeyName Name of the API key service
   */
  public getApiKeys(apiKeyName: string): string[] {
    const normalizedName = apiKeyName.toLowerCase();
    return this.apiKeys[normalizedName] || [];
  }

  /**
   * Get a specific API key by name and index
   * @param apiKeyName Name of the API key service
   * @param index Index of the specific key to retrieve
   */
  public getApiKey(apiKeyName: string, index: number = 0): string | undefined {
    const keys = this.getApiKeys(apiKeyName);
    if (keys.length > 0) {
      return keys[index % keys.length]; // Cycle through keys if index is out of bounds
    }
    return undefined;
  }

  /**
   * Execute a function by name with provided parameters
   * @param name Name of the function to execute
   * @param params Parameters to pass to the function
   * @param context Context object with additional information
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