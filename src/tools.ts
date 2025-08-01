import { jsonSchema, tool, ToolSet, generateText } from 'ai';
import { invoke, tools as awsTools } from '@ddegtyarev/aws-tools';
import fs from 'fs-extra';
import * as path from 'path';
import { ulid } from 'ulid';
import { generatePNGChart } from './chartUtils.js';

interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

interface ToolResult {
  summary: string;
  datapointsPath?: string;
  chartPath?: string;
  chartAnalysis?: string;
}

/**
 * Creates AI SDK compatible tools from aws-tools package
 */
export function createTools(
  namesList: string[],
  credentials: Credentials,
  region: string,
  outputPath: string,
  model: any,
  executionId: string,
  service: string
): ToolSet {
  const toolSet: ToolSet = {};

  for (const toolName of namesList) {
    // Find the tool definition from aws-tools
    const awsTool = awsTools.find(t => t.name === toolName);
    
    if (!awsTool) {
      console.warn(`⚠️  Tool not found in aws-tools: ${toolName}`);
      continue;
    }

    if (!awsTool.inputSchema) {
      console.warn(`⚠️  No input schema found for tool: ${toolName}`);
      continue;
    }

    console.log(`📦 Creating AI SDK tool: ${toolName}`);

    toolSet[toolName] = tool({
      description: awsTool.description,
      parameters: jsonSchema(awsTool.inputSchema),
      execute: async (params: any): Promise<ToolResult> => {
        console.log(`🔧 TOOL CALL: ${toolName} with params:`, JSON.stringify(params, null, 2));
        
        try {
          // Prepare credentials for aws-tools
          const toolCredentials = {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            ...(credentials.sessionToken && { sessionToken: credentials.sessionToken })
          };

          // Invoke the aws-tool
          const result = await invoke(toolName, params, {
            credentials: toolCredentials,
            region: region
          });

          console.log(`✅ TOOL RESULT: ${toolName} returned data`);

          // Generate a single call ID for this tool execution
          const callId = generateUniqueId();
          const sanitizedService = service.replace(/\s+/g, '_');
          const serviceRegion = `${sanitizedService}-${region}`;
          const toolDir = path.join(outputPath, executionId, serviceRegion, toolName);

          // Prepare the result object
          const toolResult: ToolResult = {
            summary: result.summary || 'Tool execution completed'
          };

          // Handle datapoints if present
          if (result.datapoints) {
            const datapointsFilename = `${callId}-data.json`;
            const datapointsPath = path.join(toolDir, datapointsFilename);
            
            await fs.ensureDir(path.dirname(datapointsPath));
            await fs.writeFile(datapointsPath, JSON.stringify(result.datapoints, null, 2));
            
            toolResult.datapointsPath = datapointsPath;
            console.log(`💾 Datapoints saved to: ${datapointsPath}`);
          }

          // Handle chart if present
          if (result.chart) {
            try {
              const chartFilename = `${callId}-chart`;
              const chartPath = path.join(toolDir, `${chartFilename}.png`);
              
              await fs.ensureDir(toolDir);
              
              // Render chart to PNG
              console.log(`🎨 Rendering chart to PNG: ${chartPath}`);
              await generatePNGChart(result.chart, chartFilename, toolDir);
              
              toolResult.chartPath = chartPath;

              // Analyze the chart using the model
              console.log(`🤖 Analyzing chart ${chartPath}`);
              const chartAnalysis = await analyzeChart(chartPath, model, toolName, result.summary);
              toolResult.chartAnalysis = chartAnalysis;
              console.log(`✅ Chart analysis completed: ${chartAnalysis}`);

            } catch (chartError) {
              console.error(`❌ Chart processing failed for ${toolName}:`, chartError);
              // Continue without chart - don't fail the entire tool execution
            }
          }

          console.log(`🔍 Tool result: ${JSON.stringify(toolResult, null, 2)}`);
          return toolResult;

        } catch (error) {
          console.error(`❌ TOOL ERROR: ${toolName} failed:`, error);
          return {
            summary: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }
    });
  }

  console.log(`✅ Created ${Object.keys(toolSet).length} AI SDK tools`);
  return toolSet;
}

/**
 * Analyze a chart image using the provided model
 */
async function analyzeChart(
  chartPath: string,
  model: any,
  toolName: string,
  context: string
): Promise<string> {
  try {
    // Read the chart image
    const imageBuffer = await fs.readFile(chartPath);
    const base64Image = imageBuffer.toString('base64');

    const prompt = `
Analyze this chart generated by the ${toolName} AWS tool and provide insights.

Context: ${context}

Please provide a concise analysis focusing on:
1. What the chart shows (data patterns, trends)
2. Key insights about AWS costs or metrics
3. Notable patterns or anomalies

Keep the analysis concise but informative.
`;

    const result = await generateText({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image',
              image: `data:image/png;base64,${base64Image}`
            }
          ]
        }
      ],
      maxTokens: 1000,
      temperature: 0.3
    });

    return result.text;

  } catch (error) {
    console.error('Error analyzing chart:', error);
    return `Chart analysis failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Generate a ULID for unique filenames
 */
function generateUniqueId(): string {
  return ulid();
} 