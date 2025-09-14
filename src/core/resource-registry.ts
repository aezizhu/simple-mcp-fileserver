import { injectable, inject } from 'inversify';
import { ConfigService } from '../services/config.service';
import { LoggerService } from '../services/logger.service';
import { Resource, ResourceTemplate } from '../types/mcp';

@injectable()
export class ResourceRegistry {
  private resources: Map<string, Resource> = new Map();

  constructor(
    @inject('ConfigService') private config: ConfigService,
    @inject('LoggerService') private logger: LoggerService
  ) {}

  registerResource(resource: Resource): void {
    this.resources.set(resource.uri, resource);
    this.logger.info('Resource registered', { uri: resource.uri });
  }

  getResource(uri: string): Resource | undefined {
    return this.resources.get(uri);
  }

  listResources(): Resource[] {
    return Array.from(this.resources.values());
  }

  async getAvailableResources(securityContext: any): Promise<Resource[]> {
    // Simple implementation - in production this would check permissions
    return this.listResources();
  }

  async readResource(uri: string, securityContext: any, requestId?: string): Promise<any> {
    const resource = this.getResource(uri);
    if (!resource) {
      throw new Error(`Resource ${uri} not found`);
    }
    // Simple implementation - in production this would check permissions
    return resource;
  }

  unregisterResource(uri: string): void {
    this.resources.delete(uri);
    this.logger.info('Resource unregistered', { uri });
  }

  getHealthStatus(): any {
    return {
      status: 'healthy',
      resources: this.resources.size
    };
  }

  async initialize(): Promise<void> {
    // Initialize resource registry
    this.logger.info('Resource registry initialized');
  }
}
