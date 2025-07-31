import { invoke } from '@ddegtyarev/aws-tools';
import { config } from './config.js';
import { ServiceRegionCombo } from './types.js';

export class AWSService {
  private credentials: any;

  constructor() {
    const creds = config.getCredentials();
    this.credentials = {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
      region: creds.region
    };
    
    // Debug: Log credentials (without sensitive data)
    console.log('AWS Service initialized with credentials:', {
      accessKeyId: creds.accessKeyId ? `${creds.accessKeyId.substring(0, 8)}...` : 'undefined',
      region: creds.region,
      hasSessionToken: !!creds.sessionToken
    });
  }

  /**
   * Get top service-region combinations by cost
   */
  async getTopServiceRegionCombos(topN: number = 10): Promise<ServiceRegionCombo[]> {
    try {
      console.log('Fetching AWS cost per service per region data...');
      
      const inputParams = {
        granularity: 'MONTHLY',
        lookBack: 1  // Look back 1 month for the most recent data
      };
      
      const configParams = {
        credentials: this.credentials,
        region: this.credentials.region
      };
      
      console.log('Calling awsCostPerServicePerRegion tool...', JSON.stringify(inputParams, null, 2));
      // Call the awsCostPerServicePerRegion tool
      const costData = await invoke('awsCostPerServicePerRegion', inputParams, configParams);

      // Parse and transform the cost data
      const serviceRegionCombos = this.parseCostData(costData);

      // Sort by cost in descending order and take top N
      return serviceRegionCombos
        .sort((a, b) => b.cost - a.cost)
        .slice(0, topN);

    } catch (error) {
      console.error('Error fetching AWS cost data:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch AWS cost data: ${errorMessage}`);
    }
  }

  /**
   * Parse raw cost data into ServiceRegionCombo objects
   */
  private parseCostData(costData: any): ServiceRegionCombo[] {
    const combos: ServiceRegionCombo[] = [];

    try {
      // Parse the new structure from @ddegtyarev/aws-tools
      if (costData.datapoints && Array.isArray(costData.datapoints)) {
        for (const datapoint of costData.datapoints) {
          const dimensions = datapoint.dimensions || {};
          
          // Each dimension key is a service-region combination like "AWS Lambda, us-east-1"
          // and the value is the cost for that combination
          for (const [serviceRegionKey, costValue] of Object.entries(dimensions)) {
            // Parse the service-region key
            const parts = serviceRegionKey.split(', ');
            let service: string;
            let region: string;
            
            if (parts.length >= 2) {
              // Last part is typically the region
              region = parts[parts.length - 1];
              // Everything else is the service name
              service = parts.slice(0, -1).join(', ');
            } else {
              // Fallback if no comma separation
              service = serviceRegionKey;
              region = 'global';
            }
            
            const cost = typeof costValue === 'string' ? parseFloat(costValue) : Number(costValue);
            
            if (cost > 0) {
              combos.push({
                service,
                region,
                cost,
                currency: 'USD',
                period: datapoint.date || 'Unknown'
              });
            }
          }
        }
      }

      return combos;
    } catch (error) {
      console.error('Error parsing cost data:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse cost data: ${errorMessage}`);
    }
  }
} 