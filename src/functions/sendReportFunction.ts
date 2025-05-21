import { FunctionDefinition, FunctionContext } from '../types';

/**
 * Function to send a report to specified recipients 
 * This is designed to be used with the job queue to schedule reports
 */
export const functionDefinition: FunctionDefinition = {
  name: 'sendReport',
  description: 'Generates and sends a report to specified recipients',
  type: 'local',
  parameters: {
    type: 'object',
    properties: {
      reportType: {
        type: 'string',
        enum: ['daily', 'weekly', 'monthly', 'quarterly', 'custom'],
        description: 'Type of report to generate',
        default: 'daily'
      },
      sector: {
        type: 'string',
        description: 'Sector or subject of the report',
        default: 'general'
      },
      startDate: {
        type: 'string',
        description: 'Start date for the report data (ISO format)',
        default: ''
      },
      endDate: {
        type: 'string',
        description: 'End date for the report data (ISO format)',
        default: ''
      },
      format: {
        type: 'string',
        enum: ['pdf', 'html', 'csv', 'json'],
        description: 'Format of the report',
        default: 'pdf'
      },
      recipients: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Email addresses of recipients'
      },
      includeCharts: {
        type: 'boolean',
        description: 'Whether to include charts in the report',
        default: true
      },
      includeSummary: {
        type: 'boolean',
        description: 'Whether to include an executive summary',
        default: true
      },
      notifyCompletion: {
        type: 'boolean',
        description: 'Whether to send a notification when job completes',
        default: true
      }
    },
    required: ['reportType', 'recipients']
  },
  handler: async (params: Record<string, any>, context?: FunctionContext) => {
    const reportType = params.reportType as string;
    const sector = params.sector as string;
    const startDate = params.startDate as string;
    const endDate = params.endDate as string;
    const format = params.format as string;
    const recipients = params.recipients as string[];
    const includeCharts = params.includeCharts as boolean;
    const includeSummary = params.includeSummary as boolean;
    const notifyCompletion = params.notifyCompletion as boolean;
    const userId = context?.userId || 'anonymous';
    
    try {
      // Log the job start
      console.log(`Starting report generation job for ${reportType} ${sector} report`);
      
      // Simulate report generation process
      await simulateReportGeneration(reportType);
      
      // Simulate sending report to recipients
      const sentStatus = await simulateSendingReport(recipients, format);
      
      // Send completion notification if requested
      let notificationStatus = null;
      if (notifyCompletion) {
        notificationStatus = await simulateNotification(userId, reportType, sector);
      }
      
      // Return success result with details
      return {
        status: 'success',
        jobType: 'report',
        reportType,
        sector,
        format,
        recipientCount: recipients.length,
        sentTo: recipients,
        generatedAt: new Date().toISOString(),
        dateRange: startDate && endDate ? `${startDate} to ${endDate}` : 'default range',
        features: {
          charts: includeCharts,
          summary: includeSummary
        },
        notification: notificationStatus,
        message: `Successfully generated and sent ${reportType} ${sector} report to ${recipients.length} recipients`
      };
    } catch (error) {
      console.error('Error generating report:', error);
      
      // Return error result
      return {
        status: 'error',
        jobType: 'report',
        reportType,
        sector,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }
};

/**
 * Simulate report generation process with a delay based on report type
 */
async function simulateReportGeneration(reportType: string): Promise<void> {
  let delay = 1000; // 1 second base delay
  
  // Different report types take different amounts of time
  switch (reportType) {
    case 'daily':
      delay = 1000;
      break;
    case 'weekly':
      delay = 2000;
      break;
    case 'monthly':
      delay = 3000;
      break;
    case 'quarterly':
      delay = 4000;
      break;
    case 'custom':
      delay = 5000;
      break;
  }
  
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Simulate sending a report to recipients
 */
async function simulateSendingReport(recipients: string[], format: string): Promise<Record<string, any>> {
  // Simulate a delay for sending
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  // Simulate success/failure for different recipients
  const results = recipients.map(recipient => {
    const isSuccess = Math.random() > 0.1; // 90% success rate
    
    return {
      email: recipient,
      status: isSuccess ? 'sent' : 'failed',
      timestamp: new Date().toISOString()
    };
  });
  
  const successCount = results.filter(r => r.status === 'sent').length;
  const failureCount = results.length - successCount;
  
  return {
    total: recipients.length,
    success: successCount,
    failed: failureCount,
    details: results
  };
}

/**
 * Simulate sending a notification about job completion
 */
async function simulateNotification(userId: string, reportType: string, sector: string): Promise<Record<string, any>> {
  // Simulate a delay for sending notification
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  return {
    notifiedUser: userId,
    channel: 'email',
    subject: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} ${sector} report completed`,
    sentAt: new Date().toISOString(),
    status: 'delivered'
  };
}

// Register function with the Function Manager
export default function register(functionManager: any) {
  functionManager.registerFunction(functionDefinition);
}