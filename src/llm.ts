import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, generateObject, jsonSchema } from 'ai';
import { config } from './config.js';
import { LLMAnalysisRequest, ChartAnalysisResult, PlanningRequest, PlanningResponse, AnalysisStep } from './types.js';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export class LLMService {
  private model: any;

  constructor() {
    // Use default AWS credentials from environment variables for Bedrock
    const bedrock = createAmazonBedrock({region: 'us-east-1'});
    
    this.model = bedrock("us.anthropic.claude-3-7-sonnet-20250219-v1:0");
  }

  /**
   * Plan analysis steps using LLM
   */
  async planAnalysis(request: PlanningRequest): Promise<PlanningResponse> {
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
        model: this.model,
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
  async analyzeWithTools(step: AnalysisStep, tools: any[]): Promise<{ summary: string }> {
    const prompt = `
Analyze the AWS service costs for the following step:
- Title: ${step.title}
- Service: ${step.service}
- Region: ${step.region}
- Available Tools: ${tools.map(t => t.name).join(', ')}

Please provide a comprehensive analysis using the available tools to gather data and insights about this service-region combination.

Your response should include:
1. A detailed analysis of this service's cost pattern
2. Potential cost optimization recommendations
3. Insights from the tool data gathered

Your response should be comprehensive but concise, focusing on actionable insights.
`;

    try {
      const result = await generateText({
        model: this.model,
        prompt,
        maxTokens: 2000,
        temperature: 0.3
      });

      return {
        summary: result.text
      };
    } catch (error) {
      console.error('Error analyzing with tools:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to analyze with tools: ${errorMessage}`);
    }
  }

  /**
   * Analyze AWS service costs for a specific service-region combo
   */
  async analyzeServiceCosts(request: LLMAnalysisRequest): Promise<{ summary: string; chartSpec?: any }> {
    const prompt = `
Analyze the AWS service costs for the following:
- Service: ${request.service}
- Region: ${request.region}
- Cost: $${request.cost}
- Context: ${request.context}

Please provide:
1. A detailed analysis of this service's cost pattern
2. Potential cost optimization recommendations

Your response should be comprehensive but concise, focusing on actionable insights.
`;

    try {
      const result = await generateText({
        model: this.model,
        prompt,
        maxTokens: 2000,
        temperature: 0.3
      });

      // Try to extract chart specification if mentioned
      const chartSpec = this.extractChartSpec(result.text);

      return {
        summary: result.text,
        chartSpec
      };
    } catch (error) {
      console.error('Error analyzing service costs:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to analyze service costs: ${errorMessage}`);
    }
  }

  /**
   * Analyze a chart image for insights
   */
  async analyzeChart(imagePath: string, context: string): Promise<ChartAnalysisResult> {
    try {
      // Read the image file
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const prompt = `
Analyze this cost chart image and provide insights about the AWS service costs shown.

Context: ${context}

Please provide:
1. A detailed analysis of what the chart shows
2. Key insights about cost patterns, trends, or anomalies
3. Specific recommendations for cost optimization

Respond in JSON format with the following structure:
{
  "analysis": "detailed analysis of the chart",
  "insights": ["insight 1", "insight 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...]
}
`;

      const result = await generateText({
        model: this.model,
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
        maxTokens: 2000,
        temperature: 0.3
      });

      // Parse the JSON response
      try {
        const parsed = JSON.parse(result.text);
        return {
          analysis: parsed.analysis || result.text,
          insights: parsed.insights || [],
          recommendations: parsed.recommendations || []
        } as ChartAnalysisResult;
      } catch {
        // If parsing fails, return the text as analysis
        return {
          analysis: result.text,
          insights: [],
          recommendations: []
        };
      }
    } catch (error) {
      console.error('Error analyzing chart:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to analyze chart: ${errorMessage}`);
    }
  }

  /**
   * Extract chart specification from LLM response
   */
  private extractChartSpec(text: string): any {
    try {
      // Look for JSON blocks that might contain Vega-Lite specifications
      const jsonMatches = text.match(/```json\s*([\s\S]*?)\s*```/g);
      
      if (jsonMatches) {
        for (const match of jsonMatches) {
          const jsonText = match.replace(/```json\s*/, '').replace(/\s*```/, '');
          try {
            const parsed = JSON.parse(jsonText);
            // Check if it looks like a Vega-Lite spec
            if (parsed.$schema || parsed.mark || parsed.encoding) {
              // Sanitize the chart specification
              return this.sanitizeChartSpec(parsed);
            }
          } catch (e) {
            // Continue to next match
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('Failed to extract chart specification:', error);
      return null;
    }
  }

  /**
   * Sanitize chart specification to avoid formatting issues
   */
  private sanitizeChartSpec(spec: any): any {
    const sanitized = JSON.parse(JSON.stringify(spec));
    
    // Remove problematic formatting
    if (sanitized.encoding) {
      Object.keys(sanitized.encoding).forEach(key => {
        const encoding = sanitized.encoding[key];
        if (encoding && encoding.axis) {
          // Remove any problematic format strings
          if (encoding.axis.format) {
            delete encoding.axis.format;
          }
          if (encoding.axis.formatType) {
            delete encoding.axis.formatType;
          }
          if (encoding.axis.tickFormat) {
            delete encoding.axis.tickFormat;
          }
        }
      });
    }
    
    // Ensure basic required fields
    if (!sanitized.mark) {
      sanitized.mark = 'bar';
    }
    
    if (!sanitized.encoding) {
      sanitized.encoding = {};
    }
    
    return sanitized;
  }
} 