import * as path from 'path';
import fs from 'fs-extra';
import { ulid } from 'ulid';
import { getTopServiceRegionCombos } from './aws-service.js';
import { createModel, planAnalysis, analyzeWithTools } from './llm.js';
import { AnalysisResult, ReportConfig, AnalysisStep, PlanningRequest, AWSCredentials } from './types.js';
import chalk from 'chalk';
import ora from 'ora';
import { tools } from '@ddegtyarev/aws-tools';
import { createTools } from './tools.js';

/**
 * Validate that all requested tools exist
 */
export function validateTools(requestedTools: string[]): void {
  const availableTools = tools.map(tool => tool.name);
  const invalidTools = requestedTools.filter(tool => !availableTools.includes(tool));
  
  if (invalidTools.length > 0) {
    const errorMessage = `Invalid tools provided: ${invalidTools.join(', ')}\n\nAvailable tools:\n${availableTools.map(tool => `  - ${tool}`).join('\n')}`;
    throw new Error(errorMessage);
  }
}

/**
 * Execute a single analysis step
 */
export async function executeAnalysisStep(
  step: AnalysisStep, 
  outputDir: string, 
  model: any, 
  credentials: AWSCredentials
): Promise<AnalysisResult> {
  // Validate that all requested tools exist
  validateTools(step.useTools);
  
  // Generate execution ID for this analysis step
  const executionId = ulid();
  console.log(`🆔 Execution ID: ${executionId}`);
  
  // Create AI SDK compatible tools using the new tools system
  const toolCredentials = {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    sessionToken: credentials.sessionToken
  };
  
  const toolSet = createTools(
    step.useTools,
    toolCredentials,
    step.region,
    outputDir,
    model,
    executionId,
    step.service
  );
  
  // Invoke LLM with Tools - tools will handle their own execution and return structured results
  const llmResponse = await analyzeWithTools(step.service, step.region, step.title, toolSet, model);
  
  return {
    serviceRegion: { service: step.service, region: step.region, cost: 0, currency: 'USD', period: 'Unknown' },
    step,
    toolResults: [], // Tools now handle their own result processing
    summary: llmResponse,
    chartPath: undefined, // Will be handled by individual tools
    chartAnalysis: undefined, // Will be handled by individual tools
    executionId
  };
}

/**
 * Run the complete analysis flow
 */
export async function analyze(
  reportConfig: ReportConfig, 
  outputDir: string = './output',
  credentials: AWSCredentials
): Promise<AnalysisResult[]> {
  const spinner = ora('Starting AWS cost analysis...').start();
  
  try {
    // Ensure output directory exists
    await fs.ensureDir(outputDir);

    // Step 1 & 2: Get top service-region combinations ordered by cost
    spinner.text = 'Fetching top service-region combinations...';
    const serviceRegionCombos = await getTopServiceRegionCombos(reportConfig.topN, credentials);
    
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
    const model = createModel();
    const planningRequest: PlanningRequest = {
      serviceRegionCombos,
      availableTools: tools.map(tool => tool.name)
    };
    const plan = await planAnalysis(planningRequest, model);

    spinner.succeed(`Created analysis plan with ${plan.steps.length} steps`);
    console.log(chalk.blue('\nPlanned analysis steps:'));
    plan.steps.forEach((step, index) => {
      console.log(chalk.gray(`${index + 1}. ${step.title} - ${step.service} (${step.region})`));
    });

    // Step 4: Analysis Phase - Execute each planned step
    const results: AnalysisResult[] = [];
    
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const spinner2 = ora(`Executing step: ${step.title} (${i + 1}/${plan.steps.length})...`).start();

      try {
        const analysisResult = await executeAnalysisStep(step, outputDir, model, credentials);
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
          chartAnalysis: undefined,
          executionId: ulid()
        });
      }
    }

    console.log(chalk.green(`\n✅ Analysis completed for ${results.length} steps`));
    return results;

  } catch (error) {
    spinner.fail('Analysis failed');
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Analysis failed: ${errorMessage}`);
  }
}