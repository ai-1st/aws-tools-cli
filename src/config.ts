import fs from 'fs-extra';
import * as path from 'path';
import { AWSCredentials, AWSCredentialsFile } from './types.js';

export class Config {
  private static instance: Config;
  private credentials: AWSCredentials | null = null;

  private constructor() {}

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  /**
   * Load AWS credentials from .aws-creds.json file
   */
  public async loadCredentials(credentialsPath: string = '.aws-creds.json'): Promise<AWSCredentials> {
    try {
      const fullPath = path.resolve(credentialsPath);
      
      if (!await fs.pathExists(fullPath)) {
        throw new Error(`Credentials file not found at ${fullPath}`);
      }

      const credentialsData: AWSCredentialsFile = await fs.readJson(fullPath);
      
      // Validate required fields in the nested structure
      if (!credentialsData.Credentials?.AccessKeyId || !credentialsData.Credentials?.SecretAccessKey) {
        throw new Error('Invalid credentials file. Must contain Credentials.AccessKeyId and Credentials.SecretAccessKey');
      }

      // Use region from the file or default to us-east-1
      const region = credentialsData.region || 'us-east-1';

      this.credentials = {
        accessKeyId: credentialsData.Credentials.AccessKeyId,
        secretAccessKey: credentialsData.Credentials.SecretAccessKey,
        sessionToken: credentialsData.Credentials.SessionToken,
        region
      };

      return this.credentials;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load AWS credentials: ${errorMessage}`);
    }
  }

  /**
   * Get current credentials
   */
  public getCredentials(): AWSCredentials {
    if (!this.credentials) {
      throw new Error('Credentials not loaded. Call loadCredentials() first.');
    }
    return this.credentials;
  }

  /**
   * Create an example credentials file
   */
  public async createExampleCredentialsFile(outputPath: string): Promise<void> {
    const exampleCredentials: AWSCredentialsFile = {
      Credentials: {
        AccessKeyId: 'AKIA...',
        SecretAccessKey: 'your-secret-access-key',
        SessionToken: 'your-session-token-if-using-temporary-credentials'
      },
      region: 'us-east-1'
    };

    await fs.writeJson(outputPath, exampleCredentials, { spaces: 2 });
  }
}

export const config = Config.getInstance(); 