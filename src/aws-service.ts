import { invoke } from '@ddegtyarev/aws-tools';
import { ServiceRegionCombo, AWSCredentials } from './types.js';

/**
 * Parse raw cost data into ServiceRegionCombo objects
 */
function parseCostData(costData: any): ServiceRegionCombo[] {
  const combos: ServiceRegionCombo[] = [];
  
  if (!costData.datapoints || !Array.isArray(costData.datapoints)) {
    console.warn('No datapoints found in cost data');
    return combos;
  }
  
  // Each datapoint should have dimensions and costs
  for (const datapoint of costData.datapoints) {
    const dimensions = datapoint.dimensions || {};
    
    // Each dimension key is a service-region combination like "AWS Lambda, us-east-1"
    for (const [serviceRegionKey, costValue] of Object.entries(dimensions)) {
      // Parse the service-region key
      const parts = serviceRegionKey.split(', ');
      let service: string;
      let region: string;
      
      if (parts.length >= 2) {
        service = parts[0];
        region = parts[1];
      } else {
        // Fallback if format is different
        service = serviceRegionKey;
        region = 'unknown';
      }
      
      const cost = typeof costValue === 'number' ? costValue : parseFloat(String(costValue)) || 0;
      
      combos.push({
        service,
        region,
        cost,
        currency: 'USD',
        period: datapoint.period || 'Unknown'
      });
    }
  }
  
  return combos;
}

/**
 * Get top service-region combinations by cost
 */
export async function getTopServiceRegionCombos(
  topN: number = 10, 
  awsCredentials: AWSCredentials
): Promise<ServiceRegionCombo[]> {
  try {
    console.log('Fetching AWS cost per service per region data...');
    
    const credentials = {
      accessKeyId: awsCredentials.accessKeyId,
      secretAccessKey: awsCredentials.secretAccessKey,
      sessionToken: awsCredentials.sessionToken,
      region: awsCredentials.region
    };
    
    // Debug: Log credentials (without sensitive data)
    console.log('AWS Service initialized with credentials:', {
      accessKeyId: awsCredentials.accessKeyId ? `${awsCredentials.accessKeyId.substring(0, 8)}...` : 'undefined',
      region: awsCredentials.region,
      hasSessionToken: !!awsCredentials.sessionToken
    });

    const inputParams = {
      granularity: 'MONTHLY',
      lookBack: 1,
      groupBy: ['SERVICE']
    };

    console.log('Calling awsCostPerServicePerRegion tool...', JSON.stringify(inputParams, null, 2));
    // Call the awsCostPerServicePerRegion tool
    const costData = await invoke('awsCostPerServicePerRegion', inputParams, {
      credentials: credentials,
      region: awsCredentials.region || 'us-east-1'
    });

    // Parse and return top combinations
    const serviceRegionCombos = parseCostData(costData);
    
    // Sort by cost (descending) and return top N
    return serviceRegionCombos
      .sort((a, b) => b.cost - a.cost)
      .slice(0, topN);
  } catch (error) {
    console.error('Error fetching cost data:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch service-region combinations: ${errorMessage}`);
  }
}