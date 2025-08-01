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
  credentials: AWSCredentials,
  executionId: string
): Promise<AnalysisResult> {
  // Validate that all requested tools exist
  validateTools(step.useTools);
  
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
  
  return llmResponse;
}

/**
 * Run the complete analysis flow
 */
export async function analyze(
  reportConfig: ReportConfig, 
  outputDir: string = './output',
  credentials: AWSCredentials,
  executionId: string
): Promise<[string, AnalysisResult][]> {
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
    const results: [string, AnalysisResult][] = [];
    
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const spinner2 = ora(`Executing step: ${step.title} (${i + 1}/${plan.steps.length})...`).start();

      try {
        const analysisResult = await executeAnalysisStep(step, outputDir, model, credentials, executionId);
        
        // Generate individual step report
        const sanitizedService = step.service.replace(/\s+/g, '_');
        const serviceRegion = `${sanitizedService}-${step.region}`;
        const { generateStepReport } = await import('./report-generator.js');
        const reportPath = await generateStepReport(analysisResult, outputDir, executionId, serviceRegion);
        
        // Create tuple of (report_path, markdown_content)
        results.push([reportPath, analysisResult]);
        spinner2.succeed(`Completed step: ${step.title}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        spinner2.fail(`Failed to execute step: ${step.title}: ${errorMessage}`);
        // Continue with other steps
        const failedAnalysis = `# Analysis Failed\n\nStep failed: ${errorMessage}`;
        const sanitizedService = step.service.replace(/\s+/g, '_');
        const serviceRegion = `${sanitizedService}-${step.region}`;
        const { generateStepReport } = await import('./report-generator.js');
        const reportPath = await generateStepReport(failedAnalysis, outputDir, executionId, serviceRegion);
        results.push([reportPath, failedAnalysis]);
      }
    }

    // Step 5: Compile comprehensive report using LLM
    spinner.text = 'Compiling comprehensive report...';
    const compiledReport = await compileComprehensiveReport(results, executionId, model);
    
    // Write the comprehensive report
    const { generateAnalysisPaths } = await import('./report-generator.js');
    const reportDir = path.join(outputDir, executionId);
    const comprehensiveReportPath = path.join(reportDir, 'report.md');
    await fs.ensureDir(reportDir);
    await fs.writeFile(comprehensiveReportPath, compiledReport, 'utf8');
    
    spinner.succeed(`Analysis completed for ${results.length} steps`);
    console.log(chalk.green(`\n✅ Comprehensive report generated: ${comprehensiveReportPath}`));
    return results;

  } catch (error) {
    spinner.fail('Analysis failed');
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Analysis failed: ${errorMessage}`);
  }
}

/**
 * Compile individual analysis reports into a comprehensive report using LLM
 */
async function compileComprehensiveReport(
  results: [string, AnalysisResult][], 
  executionId: string,
  model: any
): Promise<string> {
  const { generateText } = await import('ai');
  
  // Prepare the content for LLM compilation
  const analysisOverview = results.map(([reportPath, content], index) => {
    // Extract relative path for linking
    const relativePath = path.basename(reportPath);
    // Extract title from markdown content
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : `Analysis ${index + 1}`;
    
    return {
      title,
      relativePath,
      content: content.substring(0, 1000) + (content.length > 1000 ? '...' : '') // Truncate for overview
    };
  }).filter(item => !item.content.includes('Analysis Failed'));

  const prompt = `
You are tasked with creating a comprehensive AWS cost analysis report that summarizes and links to individual service analyses.

Execution ID: ${executionId}
Number of analyses completed: ${results.length}
Successful analyses: ${analysisOverview.length}

Individual Analysis Reports:
${analysisOverview.map((item, index) => `
${index + 1}. **${item.title}**
   - Report file: ${item.relativePath}
   - Preview: ${item.content.split('\n').slice(0, 5).join(' ').substring(0, 200)}...
`).join('\n')}

Please create a comprehensive executive summary report that:

1. **Executive Summary**: Provide a high-level overview of all analyzed services
2. **Cost Overview**: Summarize total costs and key cost drivers across all services
3. **Key Findings**: Highlight the most important insights from all analyses
4. **Cross-Service Recommendations**: Provide optimization recommendations that span multiple services
5. **Individual Service Links**: Include a section with links to detailed individual reports

Format the report in markdown and include relative links to individual reports like:
- [Service Name Analysis](./service-region-analysis.md)

Make the report comprehensive but concise, focusing on actionable insights and strategic recommendations.
`;

  try {
    const result = await generateText({
      model: model,
      prompt,
      maxTokens: 4096,
      temperature: 0.3
    });

    return result.text;
  } catch (error) {
    console.error('Error compiling comprehensive report:', error);
    // Fallback to a simple compilation
    return createFallbackReport(results, executionId);
  }
}

/**
 * Create a fallback comprehensive report without LLM
 */
function createFallbackReport(results: [string, AnalysisResult][], executionId: string): string {
  const successfulAnalyses = results.filter(([_, content]) => !content.includes('Analysis Failed'));
  const timestamp = new Date().toISOString();
  
  let report = `# AWS Cost Analysis Comprehensive Report

**Execution ID**: ${executionId}
**Generated**: ${new Date(timestamp).toLocaleString()}
**Total Analyses**: ${results.length}
**Successful Analyses**: ${successfulAnalyses.length}

## Executive Summary

This comprehensive report analyzes ${results.length} AWS service-region combinations to identify cost patterns, optimization opportunities, and strategic recommendations for your cloud infrastructure.

## Individual Service Analyses

`;

  results.forEach(([reportPath, content]) => {
    const relativePath = path.basename(reportPath);
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : 'Analysis Report';
    const isSuccessful = !content.includes('Analysis Failed');
    
    report += `### ${title}
- **Status**: ${isSuccessful ? '✅ Completed' : '❌ Failed'}
- **Detailed Report**: [${title}](./${relativePath})

`;
  });

  report += `
## Summary

For detailed analysis of each service, please refer to the individual reports linked above. Each report contains specific cost patterns, optimization recommendations, and actionable insights for that particular service-region combination.

---
*Report generated by AWS Cost Analyzer CLI*
`;

  return report;
}