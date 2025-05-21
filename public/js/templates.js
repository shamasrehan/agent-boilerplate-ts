/**
 * Message templates for the AI Agent Boilerplate
 */
const messageTemplates = {
    // Default request template
    default: {
      intent: "REQUEST",
      action: "READ",
      entity: {
        type: "PRICE_FEED",
        context: {
          description: "Get the latest price feed for Bitcoin and Ethereum"
        }
      }
    },
    
    // Weather request template
    weather: {
      intent: "REQUEST",
      action: "EXECUTE",
      entity: {
        type: "WEATHER",
        context: {
          description: "Get current weather information for London",
          parameters: {
            city: "London",
            units: "metric"
          }
        }
      }
    },
    
    // Direct function execution template
    function: {
      type: "function:execute",
      payload: {
        name: "getWeather",
        params: {
          city: "New York",
          units: "metric"
        },
        context: {}
      },
      metadata: {
        priority: "high"
      }
    },
    
    // Job scheduling template
    job: {
      type: "job:schedule",
      payload: {
        name: "periodicWeatherCheck",
        data: {
          locations: ["Tokyo", "Paris", "Sydney"],
          interval: "hourly"
        },
        priority: 5,
        delay: 0,
        attempts: 3
      }
    },
    
    // Custom empty template
    custom: {
      intent: "",
      action: "",
      entity: {
        type: "",
        context: {}
      }
    }
  };
  
  // Response template
  const responseTemplate = {
    intent: "INFORM",
    action: "READ",
    entity: {
      type: "AGENT",
      context: {
        description: "Response from the AI Agent",
        data: {}
      }
    }
  };