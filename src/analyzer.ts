import * as path from 'path';
import fs from 'fs-extra';
import { AWSService } from './aws-service.js';
import { LLMService } from './llm.js';
import { AnalysisResult, ServiceRegionCombo, ReportConfig, AnalysisStep, PlanningRequest, PlanningResponse, ToolResult } from './types.js';
import { generatePNGChart } from './chartUtils.js';
import chalk from 'chalk';
import ora from 'ora';
import { tools } from '@ddegtyarev/aws-tools';

export class CostAnalyzer {
  private awsService: AWSService;
  private llmService: LLMService;
  private outputDir: string;

  constructor(outputDir: string = './output') {
    this.awsService = new AWSService();
    this.llmService = new LLMService();
    this.outputDir = outputDir;
  }

  /**
   * Run the complete analysis flow
   */
  async analyze(config: ReportConfig): Promise<AnalysisResult[]> {
    const spinner = ora('Starting AWS cost analysis...').start();
    
    try {
      // Ensure output directory exists
      await fs.ensureDir(this.outputDir);
      await fs.ensureDir(path.join(this.outputDir, 'charts'));
      await fs.ensureDir(path.join(this.outputDir, 'data'));

      // Step 1 & 2: Get top service-region combinations ordered by cost
      spinner.text = 'Fetching top service-region combinations...';
      const serviceRegionCombos = await this.awsService.getTopServiceRegionCombos(config.topN);
      
      if (serviceRegionCombos.length === 0) {
        spinner.fail('No cost data found');
        return [];
      }

      spinner.succeed(`Found ${serviceRegionCombos.length} service-region combinations`);
      console.log(chalk.blue('\nTop service-region combinations by cost:'));
      serviceRegionCombos.forEach((combo, index) => {
        console.log(chalk.gray(`${index + 1}. ${combo.service} (${combo.region}): $${combo.cost.toFixed(2)}`));
      });

      // Step 3: Planning Phase
      spinner.text = 'Planning analysis steps...';
      const planningRequest: PlanningRequest = {
        serviceRegionCombos,
        availableTools: this.getAvailableToolNamesAndDescriptions()
      };
      
      const planningResponse = await this.llmService.planAnalysis(planningRequest);
      spinner.succeed(`Planned ${planningResponse.steps.length} analysis steps`);

      console.log(chalk.blue('\nPlanned analysis steps:'));
      planningResponse.steps.forEach((step, index) => {
        console.log(chalk.gray(`${index + 1}. ${step.title} - ${step.service} (${step.region})`));
        console.log(chalk.gray(`   Tools: ${step.useTools.join(', ')}`));
      });

      const results: AnalysisResult[] = [];

      // Step 4: Analysis Phase - Execute each planned step
      for (let i = 0; i < planningResponse.steps.length; i++) {
        const step = planningResponse.steps[i];
        const spinner2 = ora(`Executing step: ${step.title} (${i + 1}/${planningResponse.steps.length})...`).start();

        try {
          const analysisResult = await this.executeAnalysisStep(step, i);
          results.push(analysisResult);
          spinner2.succeed(`Completed step: ${step.title}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          spinner2.fail(`Failed to execute step: ${step.title}: ${errorMessage}`);
          // Continue with other steps
          results.push({
            serviceRegion: { service: step.service, region: step.region, cost: 0, currency: 'USD', period: 'Unknown' },
            step,
            toolResults: [],
            summary: `Step failed: ${errorMessage}`,
            chartPath: undefined,
            chartAnalysis: undefined
          });
        }
      }

      console.log(chalk.green(`\n✅ Analysis completed for ${results.length} steps`));
      return results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(`Analysis failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get available tool names from @ddegtyarev/aws-tools
   */
  private getAvailableToolNames(): string[] {
    const toolNames = [];
    for (const tool of tools) {
      toolNames.push(tool.name);
    }
    return toolNames;
  }

  /**
   * Get available tool names and descriptions from @ddegtyarev/aws-tools
   */
  getAvailableToolNamesAndDescriptions(): string[] {
    const toolNames = [];
    for (const tool of tools) {
      toolNames.push(tool.name + " - " + tool.description);
    }
    return toolNames;
  }

  /**
   * Validate that all requested tools exist in the aws-tools package
   */
  private validateTools(requestedTools: string[]): void {
    const availableTools = this.getAvailableToolNames();
    const invalidTools = requestedTools.filter(tool => !availableTools.includes(tool));
    
    if (invalidTools.length > 0) {
      const errorMessage = `Invalid tools provided: ${invalidTools.join(', ')}\n\nAvailable tools:\n${availableTools.map(tool => `  - ${tool}`).join('\n')}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Execute a single analysis step
   */
  async executeAnalysisStep(step: AnalysisStep, index: number): Promise<AnalysisResult> {
    // Validate that all requested tools exist
    this.validateTools(step.useTools);
    
    // Step 4.1: Configure Tools
    const configuredTools = await this.configureTools(step);
    
    // Step 4.2: Invoke LLM with Tools
    const llmResponse = await this.llmService.analyzeWithTools(step, configuredTools);
    
    // Step 4.3: Process tool results and generate charts
    const toolResults = await this.processToolResults(step, configuredTools, index);
    
    return {
      serviceRegion: { service: step.service, region: step.region, cost: 0, currency: 'USD', period: 'Unknown' },
      step,
      toolResults,
      summary: llmResponse.summary,
      chartPath: toolResults.find(r => r.chartPath)?.chartPath,
      chartAnalysis: toolResults.find(r => r.chartAnalysis)?.chartAnalysis
    };
  }

  /**
   * Configure tools for a specific step
   */
  private async configureTools(step: AnalysisStep): Promise<any[]> {
    const tools = [];
    
    for (const toolName of step.useTools) {
      const tool = await this.createTool(toolName, step.region);
      if (tool) {
        tools.push(tool);
      }
    }
    
    return tools;
  }

  /**
   * Create a tool configuration for AI SDK
   */
  private async createTool(toolName: string, region: string): Promise<any> {
    // This would be implemented based on the actual @ddegtyarev/aws-tools structure
    // For now, returning a basic tool structure
    return {
      name: toolName,
      description: `Analyze ${toolName} for the specified region`,
      parameters: {
        type: 'object',
        properties: {
          region: {
            type: 'string',
            description: 'AWS region to analyze',
            default: region
          }
        },
        required: ['region']
      }
    };
  }

  /**
   * Process tool results and generate charts
   */
  private async processToolResults(step: AnalysisStep, tools: any[], index: number): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    
    for (const tool of tools) {
      try {
        // Simulate tool execution and result processing
        const toolResult = await this.executeTool(tool, step, index);
        results.push(toolResult);
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Failed to execute tool ${tool.name}: ${error}`));
        results.push({
          summary: `Tool execution failed: ${error}`
        });
      }
    }
    
    return results;
  }

  /**
   * Execute a single tool and process its results
   */
  private async executeTool(tool: any, step: AnalysisStep, index: number): Promise<ToolResult> {
    // This would integrate with @ddegtyarev/aws-tools
    // For now, simulating the tool execution
    
    const result: ToolResult = {
      summary: `Analysis of ${tool.name} for ${step.service} in ${step.region}`
    };
    
    // Simulate chart generation if tool returns chart spec
    if (Math.random() > 0.5) { // 50% chance of chart generation
      const chartFilename = `${step.service}-${step.region}-${index}`.replace(/[^a-zA-Z0-9-]/g, '-');
      const chartPath = path.join(this.outputDir, 'charts', 'png', `${chartFilename}.png`);
      
      // Generate a sample chart
      await this.generateSampleChart(chartFilename, path.join(this.outputDir, 'charts'));
      
      result.chartPath = chartPath;
      result.chartAnalysis = `Chart analysis for ${step.service} in ${step.region}`;
    }
    
    // Simulate datapoints storage
    const datapointsFilename = `${step.service}-${step.region}-${index}-data.json`;
    const datapointsPath = path.join(this.outputDir, 'data', datapointsFilename);
    
    // Store sample datapoints
    await fs.writeJson(datapointsPath, {
      service: step.service,
      region: step.region,
      tool: tool.name,
      timestamp: new Date().toISOString(),
      data: { sample: 'data' }
    });
    
    result.datapointsPath = datapointsPath;
    
    return result;
  }

  /**
   * Generate a sample chart for demonstration
   */
  private async generateSampleChart(filename: string, outputDir: string): Promise<void> {
    const sampleChartSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: {
        values: [
          { category: 'A', value: 4 },
          { category: 'B', value: 6 },
          { category: 'C', value: 10 },
          { category: 'D', value: 3 }
        ]
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' }
      }
    };
    
    try {
      await generatePNGChart(sampleChartSpec, filename, outputDir);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Failed to generate chart: ${error}`));
    }
  }
} 