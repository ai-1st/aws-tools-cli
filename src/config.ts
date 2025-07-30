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
   * Create example credentials file
   */
  public static async createExampleCredentialsFile(filePath: string = '.aws-creds.json'): Promise<void> {
    const exampleCreds = {
      Credentials: {
        AccessKeyId: "YOUR_AWS_ACCESS_KEY_ID",
        SecretAccessKey: "YOUR_AWS_SECRET_ACCESS_KEY",
        SessionToken: "YOUR_SESSION_TOKEN_IF_USING_STS"
      },
      region: "us-east-1"
    };

    await fs.writeJson(filePath, exampleCreds, { spaces: 2 });
    console.log(`Example credentials file created at ${filePath}`);
    console.log('Please update it with your actual AWS credentials.');
  }
}

export const config = Config.getInstance(); 