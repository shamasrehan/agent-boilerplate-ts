import { Queue, Worker, Job as BullJob, QueueEvents } from 'bullmq';
import { Job, JobResult, JobStatus } from '../types';
import { EventEmitter } from 'events';
import IORedis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import MessagingManager from './MessagingManager';

interface JobQueueOptions {
  concurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
  queueName?: string;
  notifyMessaging?: boolean;
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
}

/**
 * Job Queue Manager for scheduling and processing jobs
 */
export class JobQueueManager extends EventEmitter {
  private queue: Queue;
  private worker: Worker;
  private scheduler: QueueEvents;
  private redisConnection: IORedis;
  private options: JobQueueOptions;
  private messagingManager?: MessagingManager;

  /**
   * Create a new JobQueueManager
   * @param options Configuration options for the job queue
   * @param messagingManager Optional messaging manager for job notifications
   */
  constructor(options: JobQueueOptions, messagingManager?: MessagingManager) {
    super();
    
    this.options = {
      concurrency: options.concurrency || 5,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 5000,
      queueName: options.queueName || 'agent-job-queue',
      notifyMessaging: options.notifyMessaging || false,
      redis: options.redis || {
        host: 'localhost',
        port: 6379
      }
    };
    
    this.messagingManager = messagingManager;
    
    // Initialize Redis connection
    this.redisConnection = new IORedis({
      host: this.options.redis?.host ?? 'localhost',
      port: this.options.redis?.port ?? 6379,
      password: this.options.redis?.password,
      maxRetriesPerRequest: null
    });
    
    // Create the queue
    this.queue = new Queue(this.options.queueName ?? 'agent-job-queue', {
      connection: {
        host: this.options.redis?.host ?? 'localhost',
        port: this.options.redis?.port ?? 6379,
        password: this.options.redis?.password,
        maxRetriesPerRequest: null
      }
    });
    
    // Create the queue scheduler for delayed jobs
    this.scheduler = new QueueEvents(this.options.queueName ?? 'agent-job-queue', {
      connection: {
        host: this.options.redis?.host ?? 'localhost',
        port: this.options.redis?.port ?? 6379,
        password: this.options.redis?.password,
        maxRetriesPerRequest: null
      }
    });
    
    // Create and start the worker
    this.worker = new Worker(
      this.options.queueName ?? 'agent-job-queue',
      this.processJob.bind(this),
      {
        connection: {
          host: this.options.redis?.host ?? 'localhost',
          port: this.options.redis?.port ?? 6379,
          password: this.options.redis?.password,
          maxRetriesPerRequest: null
        },
        concurrency: this.options.concurrency,
        autorun: true
      }
    );
    
    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for the worker
   */
  private setupEventListeners(): void {
    this.worker.on('completed', async (job: BullJob, result: any) => {
      const jobResult: JobResult = {
        jobId: job.id || '',
        result,
        duration: Date.now() - (job.processedOn || Date.now()),
        completedAt: new Date()
      };
      
      this.emit('job:completed', jobResult);
      
      // Notify via messaging if configured
      if (this.options.notifyMessaging && this.messagingManager) {
        await this.messagingManager.sendMessage(
          'job:completed',
          jobResult,
          job.id
        );
      }
    });
    
    this.worker.on('failed', (job: BullJob | undefined, error: Error, prev: string) => {
      if (!job) return;
      const jobResult: JobResult = {
        jobId: job.id || '',
        result: null,
        error,
        duration: Date.now() - (job.processedOn || Date.now()),
        completedAt: new Date()
      };
      
      this.emit('job:failed', jobResult);
      
      // Notify via messaging if configured
      if (this.options.notifyMessaging && this.messagingManager) {
        this.messagingManager.sendMessage(
          'job:failed',
          jobResult,
          job.id
        );
      }
    });
    
    this.worker.on('active', (job: BullJob) => {
      this.emit('job:active', { jobId: job.id });
    });
    
    this.worker.on('stalled', (jobId: string) => {
      this.emit('job:stalled', { jobId });
    });
  }

  /**
   * Process a job from the queue
   * @param job The job to process
   */
  private async processJob(job: BullJob): Promise<any> {
    try {
      // Extract the job data
      const jobData = job.data as Job;
      
      // Log job start
      console.log(`Processing job ${job.id}: ${jobData.name}`);
      
      // Execute the job handler function
      if (typeof jobData.data.handler === 'function') {
        // If the job data contains a handler function, execute it
        return await jobData.data.handler(jobData.data.params);
      } else if (typeof jobData.name === 'string' && jobData.name.includes('.')) {
        // If the job name is in format 'moduleName.functionName', try to dynamically import and execute
        const [moduleName, functionName] = jobData.name.split('.');
        
        try {
          // Dynamically import the module
          const module = await import(`../functions/${moduleName}`);
          
          // Check if the function exists in the module
          if (module[functionName] && typeof module[functionName] === 'function') {
            return await module[functionName](jobData.data);
          } else {
            throw new Error(`Function ${functionName} not found in module ${moduleName}`);
          }
        } catch (importError) {
          console.error(`Failed to import or execute ${jobData.name}:`, importError);
          throw importError;
        }
      } else {
        throw new Error(`Invalid job handler for job ${job.id}`);
      }
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Add a job to the queue
   * @param job The job to add
   */
  public async addJob(job: Omit<Job, 'id'>): Promise<string> {
    const jobId = job.name + '-' + uuidv4();
    
    const jobOptions: any = {
      removeOnComplete: job.removeOnComplete ?? true,
      removeOnFail: job.removeOnFail ?? false,
      attempts: job.attempts ?? this.options.retryAttempts,
      backoff: job.backoff ?? {
        type: 'exponential',
        delay: this.options.retryDelay
      }
    };
    
    if (job.priority !== undefined) {
      jobOptions.priority = job.priority;
    }
    
    if (job.delay !== undefined && job.delay > 0) {
      jobOptions.delay = job.delay;
    }
    
    if (job.timeout !== undefined) {
      jobOptions.timeout = job.timeout;
    }
    
    // Add the job to the queue
    await this.queue.add(job.name, {
      ...job,
      id: jobId
    }, jobOptions);
    
    return jobId;
  }

  /**
   * Get the status of a job
   * @param jobId The ID of the job to get status for
   */
  public async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = await this.queue.getJob(jobId);
    
    if (!job) {
      return null;
    }
    
    const state = await job.getState();
    
    switch (state) {
      case 'completed':
        return JobStatus.COMPLETED;
      case 'failed':
        return JobStatus.FAILED;
      case 'delayed':
        return JobStatus.DELAYED;
      case 'active':
        return JobStatus.ACTIVE;
      case 'waiting':
        return JobStatus.WAITING;
      case 'paused':
        return JobStatus.PAUSED;
      default:
        return null;
    }
  }

  /**
   * Get the result of a completed job
   * @param jobId The ID of the job to get the result for
   */
  public async getJobResult(jobId: string): Promise<any> {
    const job = await this.queue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    return job.returnvalue;
  }

  /**
   * Remove a job from the queue
   * @param jobId The ID of the job to remove
   */
  public async removeJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    
    if (job) {
      await job.remove();
    }
  }

  /**
   * Promote a delayed job to be executed immediately
   * @param jobId The ID of the job to promote
   */
  public async promoteJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    
    if (job) {
      await job.promote();
    }
  }

  /**
   * Update the priority of a job
   * @param jobId The ID of the job to update
   * @param priority The new priority value (lower is higher priority)
   */
  public async updateJobPriority(jobId: string, priority: number): Promise<void> {
    const job = await this.queue.getJob(jobId);
    
    if (job) {
      await job.changePriority(priority);
    }
  }

  /**
   * Get all jobs with a specific status
   * @param status The status to filter by
   * @param limit Maximum number of jobs to return
   * @param offset Offset for pagination
   */
  public async getJobsByStatus(
    status: JobStatus,
    limit: number = 100,
    offset: number = 0
  ): Promise<Job[]> {
    let jobs: BullJob[] = [];
    
    switch (status) {
      case JobStatus.WAITING:
        jobs = await this.queue.getWaiting(offset, offset + limit);
        break;
      case JobStatus.ACTIVE:
        jobs = await this.queue.getActive(offset, offset + limit);
        break;
      case JobStatus.COMPLETED:
        jobs = await this.queue.getCompleted(offset, offset + limit);
        break;
      case JobStatus.FAILED:
        jobs = await this.queue.getFailed(offset, offset + limit);
        break;
      case JobStatus.DELAYED:
        jobs = await this.queue.getDelayed(offset, offset + limit);
        break;
      default:
        return [];
    }
    
    return jobs.map(job => ({
      id: job.id || '',
      name: job.name,
      data: job.data.data
    }));
  }

  /**
   * Get all jobs in the queue
   * @param limit Maximum number of jobs to return
   * @param offset Offset for pagination
   */
  public async getAllJobs(limit: number = 100, offset: number = 0): Promise<Job[]> {
    const jobs = await this.queue.getJobs([], offset, offset + limit);
    
    return jobs.map(job => ({
      id: job.id || '',
      name: job.name,
      data: job.data.data
    }));
  }

  /**
   * Pause the queue processing
   */
  public async pause(): Promise<void> {
    await this.queue.pause();
  }

  /**
   * Resume the queue processing
   */
  public async resume(): Promise<void> {
    await this.queue.resume();
  }

  /**
   * Empty the queue (remove all jobs)
   */
  public async empty(): Promise<void> {
    await this.queue.obliterate({ force: true });
  }

  /**
   * Close the queue and worker
   */
  public async close(): Promise<void> {
    await this.worker.close();
    await this.scheduler.close();
    await this.queue.close();
    await this.redisConnection.quit();
  }
}

export default JobQueueManager;