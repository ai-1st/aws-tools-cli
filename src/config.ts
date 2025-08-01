import fs from 'fs-extra';
import * as path from 'path';
import { AWSCredentials, AWSCredentialsFile } from './types.js';

/**
 * Load AWS credentials from .aws-creds.json file
 */
export async function loadCredentials(credentialsPath: string = '.aws-creds.json'): Promise<AWSCredentials> {
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

    const credentials: AWSCredentials = {
      accessKeyId: credentialsData.Credentials.AccessKeyId,
      secretAccessKey: credentialsData.Credentials.SecretAccessKey,
      sessionToken: credentialsData.Credentials.SessionToken,
      region
    };

    return credentials;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load AWS credentials: ${errorMessage}`);
  }
}

/**
 * Create an example credentials file
 */
export async function createExampleCredentialsFile(outputPath: string): Promise<void> {
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