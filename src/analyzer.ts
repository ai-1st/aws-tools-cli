import * as path from 'path';
import fs from 'fs-extra';
import { AWSService } from './aws-service.js';
import { LLMService } from './llm.js';
import { config } from './config.js';
import { AnalysisResult, ReportConfig, AnalysisStep, PlanningRequest } from './types.js';
import chalk from 'chalk';
import ora from 'ora';
import { tools } from '@ddegtyarev/aws-tools';
import { createTools } from './tools.js';

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
    
    // Create AI SDK compatible tools using the new tools system
    const credentials = {
      accessKeyId: config.getCredentials().accessKeyId,
      secretAccessKey: config.getCredentials().secretAccessKey,
      sessionToken: config.getCredentials().sessionToken
    };
    
    const toolSet = createTools(
      step.useTools,
      credentials,
      step.region,
      this.outputDir,
      this.llmService.getModel()
    );
    
    // Invoke LLM with Tools - tools will handle their own execution and return structured results
    const llmResponse = await this.llmService.analyzeWithTools(step, toolSet);
    
    return {
      serviceRegion: { service: step.service, region: step.region, cost: 0, currency: 'USD', period: 'Unknown' },
      step,
      toolResults: [], // Tools now handle their own result processing
      summary: llmResponse.summary,
      chartPath: undefined, // Will be handled by individual tools
      chartAnalysis: undefined // Will be handled by individual tools
    };
  }

} 