import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, generateObject, jsonSchema, ToolSet } from 'ai'; 
import { ChartAnalysisResult, PlanningRequest, PlanningResponse, AnalysisStep } from './types.js';
import fs from 'fs-extra';

/**
 * Create AI model instance
 */
export function createModel() {
  const bedrock = createAmazonBedrock({region: 'us-east-1'});
  return bedrock("us.anthropic.claude-sonnet-4-20250514-v1:0");
}

/**
 * Plan analysis steps using LLM
 */
export async function planAnalysis(request: PlanningRequest, model: any): Promise<PlanningResponse> {
  const prompt = `
You are an AWS cost analysis expert. Given the following service-region combinations and available tools, create a plan for analyzing each service.

Service-Region Combinations:
${request.serviceRegionCombos.map((combo, index) => 
  `${index + 1}. ${combo.service} (${combo.region}): $${combo.cost.toFixed(2)}`
).join('\n')}

Available Tools:
${request.availableTools.map(tool => `- ${tool}`).join('\n')}

Create a structured plan with analysis steps. Each step should:
1. Focus on a specific service-region combination
2. Select appropriate tools for that service
3. Have a clear, descriptive title

For each service-region combination, create an analysis step that uses the most relevant tools for that specific service.
`;

  console.log(prompt);
  try {
    const result = await generateObject({
      model: model,
      prompt,
      schema: jsonSchema({
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'A descriptive title for the analysis step'
                },
                service: {
                  type: 'string',
                  description: 'The AWS service name to analyze'
                },
                region: {
                  type: 'string',
                  description: 'The AWS region to analyze'
                },
                useTools: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'Array of tool names to use for this step'
                }
              },
              required: ['title', 'service', 'region', 'useTools']
            }
          }
        },
        required: ['steps']
      }),
      maxTokens: 2000,
      temperature: 0.3
    });

    return result.object as PlanningResponse;
  } catch (error) {
    console.error('Error planning analysis:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to plan analysis: ${errorMessage}`);
  }
}

/**
 * Analyze with tools using AI SDK
 */
export async function analyzeWithTools(
  service: string,
  region: string,
  title: string,
  tools: ToolSet,
  model: any
): Promise<string> {
  console.log(`📝 Sending prompt to LLM with ${Object.keys(tools).length} tools available...`);
  const prompt = `
Analyze the AWS service costs for the following step:
- Title: ${title}
- Service: ${service}
- Region: ${region}

Please provide a comprehensive analysis using the available tools to gather data and insights about this service-region combination.

Your response should include:
1. A detailed analysis of this service's cost pattern
2. Potential cost optimization recommendations
3. Insights from the tool data gathered

Keep in mind that it doesn't make sense to group by a dimension while filtering by the same dimension - there will be only one group anyway.

The response should be in MarkDown format.

The tools may return a path to a PNG image with the chart, along with a text description of the chart.
Please embed the chart in your response if it is relevant and helpful.
Example image embedding:
<p align="center">
  <img
    src="./output/image_name.png" width="800"
  />
</p>
`;

  console.log(`🤖 LLM PROMPT:`, prompt);

  try {
    console.log(`🚀 Calling LLM with tools...`);
    const result = await generateText({
      model: model,
      prompt,
      tools,
      maxSteps: 99, // Allow multiple tool calls
      maxTokens: 8192,
    });

    console.log(`✅ LLM RESPONSE:`, result.text);
    console.log(`📊 LLM STEPS:`, result.steps?.length || 0);

    return result.text;
  } catch (error) {
    console.error('❌ Error analyzing with tools:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to analyze with tools: ${errorMessage}`);
  }
}