#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import { loadCredentials, createExampleCredentialsFile } from './config.js';
import { analyze, executeAnalysisStep } from './analyzer.js';
import { ReportGenerator } from './report-generator.js';
import { createModel } from './llm.js';
import { ReportConfig } from './types.js';

const program = new Command();

program
  .name('aws-cost-analyzer')
  .description('AI-powered AWS cost analysis tool with chart generation')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze AWS costs and generate a detailed report')
  .option('-c, --credentials <path>', 'Path to AWS credentials file', '.aws-creds.json')
  .option('-o, --output <path>', 'Output path for the markdown report', './output/aws-cost-report.md')
  .option('-n, --top <number>', 'Number of top service-region combinations to analyze', '10')
  .option('--no-charts', 'Disable chart generation')
  .option('--summary-only', 'Generate only a summary report')
  .action(async (options) => {
    const spinner = ora('Initializing AWS Cost Analyzer...').start();
    
    try {
      // Load AWS credentials
      spinner.text = 'Loading AWS credentials...';
      const credentials = await loadCredentials(options.credentials);
      spinner.succeed('AWS credentials loaded');

      // Parse options
      const topN = parseInt(options.top, 10);
      if (isNaN(topN) || topN <= 0) {
        throw new Error('Top number must be a positive integer');
      }

      const reportConfig: ReportConfig = {
        outputPath: path.resolve(options.output),
        includeCharts: options.charts !== false,
        topN
      };

      // Create analyzer and run analysis
      const outputDir = path.dirname(reportConfig.outputPath);
      // Load credentials
      const awsCredentials = await loadCredentials();
      console.log(chalk.green('✔ AWS credentials loaded'));
      
      console.log(chalk.blue(`\n🔍 Starting analysis of top ${topN} service-region combinations...\n`));
      
      const results = await analyze(reportConfig, outputDir, awsCredentials);

      if (results.length === 0) {
        console.log(chalk.yellow('No cost data found to analyze'));
        return;
      }

      // Generate report
      const reportGenerator = new ReportGenerator(outputDir);
      
      if (options.summaryOnly) {
        const summaryPath = reportConfig.outputPath.replace('.md', '-summary.md');
        await reportGenerator.generateSummaryReport(results, summaryPath);
      } else {
        await reportGenerator.generateReport(results, reportConfig);
        
        // Also generate summary
        const summaryPath = reportConfig.outputPath.replace('.md', '-summary.md');
        await reportGenerator.generateSummaryReport(results, summaryPath);
      }

      console.log(chalk.green('\n✅ Analysis completed successfully!'));
      console.log(chalk.gray(`Full report: ${reportConfig.outputPath}`));
      
      // Show quick stats
      const totalCost = results.reduce((sum: number, result: any) => sum + result.serviceRegion.cost, 0);
      const successfulAnalyses = results.filter((r: any) => r.summary && !r.summary.includes('Analysis failed')).length;
      const chartsGenerated = results.filter((r: any) => r.chartPath).length;

      console.log(chalk.blue('\n📊 Analysis Summary:'));
      console.log(chalk.gray(`  Total cost analyzed: $${totalCost.toFixed(2)}`));
      console.log(chalk.gray(`  Successful analyses: ${successfulAnalyses}/${results.length}`));
      console.log(chalk.gray(`  Charts generated: ${chartsGenerated}`));

    } catch (error) {
      spinner.fail('Analysis failed');
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${errorMessage}`));
      process.exit(1);
    }
  });

program
  .command('analyze-step')
  .description('Analyze a specific service-region combination with specified tools')
  .option('-s, --service <service>', 'AWS service name', '')
  .option('-r, --region <region>', 'AWS region', 'us-east-1')
  .option('-c, --cost <cost>', 'Service cost', '0')
  .option('-t, --tools <tools>', 'Comma-separated list of tools to use', 'awsGetCostAndUsage')
  .option('-o, --output <path>', 'Output path for the markdown report', './output/step-analysis.md')
  .action(async (options) => {
    const spinner = ora('Initializing step analysis...').start();
    
    try {
      // Load AWS credentials
      spinner.text = 'Loading AWS credentials...';
      const credentials = await loadCredentials(options.credentials || '.aws-creds.json');
      spinner.succeed('AWS credentials loaded');

      // Parse tools
      const tools = options.tools.split(',').map((t: string) => t.trim());
      const cost = parseFloat(options.cost) || 0;

      if (!options.service) {
        throw new Error('Service name is required. Use -s or --service to specify.');
      }

      // Create analysis step
      const step = {
        title: `Direct Analysis of ${options.service} in ${options.region}`,
        service: options.service,
        region: options.region,
        useTools: tools
      };

      console.log(chalk.blue(`\n🔍 Starting direct analysis of ${options.service} in ${options.region}...\n`));
      console.log(chalk.gray(`Cost: $${cost.toFixed(2)}`));
      console.log(chalk.gray(`Tools: ${tools.join(', ')}`));

      // Create analyzer and run step analysis
      const outputDir = path.dirname(options.output);
      const model = createModel();
      
      const result = await executeAnalysisStep(step, outputDir, model, credentials);

      // Generate report for this step in the structured directory
      const sanitizedService = result.step.service.replace(/\s+/g, '_');
      const serviceRegion = `${sanitizedService}-${result.step.region}`;
      const reportDir = path.join(outputDir, result.executionId);
      const reportPath = path.join(reportDir, `${serviceRegion}-analysis.md`);
      
      const reportGenerator = new ReportGenerator(outputDir);
      await reportGenerator.generateStepReport([result], reportPath);

      console.log(chalk.green('\n✅ Step analysis completed successfully!'));
      console.log(chalk.gray(`Report: ${reportPath}`));
      
      // Show quick stats
      const successfulAnalysis = result.summary && !result.summary.includes('Step failed');
      const chartsGenerated = result.chartPath ? 1 : 0;

      console.log(chalk.blue('\n📊 Step Analysis Summary:'));
      console.log(chalk.gray(`  Service: ${options.service}`));
      console.log(chalk.gray(`  Region: ${options.region}`));
      console.log(chalk.gray(`  Cost: $${cost.toFixed(2)}`));
      console.log(chalk.gray(`  Tools used: ${tools.join(', ')}`));
      console.log(chalk.gray(`  Analysis successful: ${successfulAnalysis ? 'Yes' : 'No'}`));
      console.log(chalk.gray(`  Charts generated: ${chartsGenerated}`));

    } catch (error) {
      spinner.fail('Step analysis failed');
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${errorMessage}`));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Create an example AWS credentials file')
  .option('-o, --output <path>', 'Output path for credentials file', '.aws-creds.json')
  .action(async (options) => {
    try {
      await createExampleCredentialsFile(options.output);
      console.log(chalk.green('✅ Example credentials file created'));
      console.log(chalk.yellow('⚠️  Please update the file with your actual AWS credentials'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${errorMessage}`));
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate AWS credentials and connection')
  .option('-c, --credentials <path>', 'Path to AWS credentials file', '.aws-creds.json')
  .action(async (options) => {
    const spinner = ora('Validating AWS credentials...').start();
    
    try {
      const credentials = await loadCredentials(options.credentials);
      spinner.succeed('AWS credentials are valid');
      
      console.log(chalk.blue('Credentials info:'));
      console.log(chalk.gray(`  Region: ${credentials.region}`));
      console.log(chalk.gray(`  Access Key ID: ${credentials.accessKeyId.substring(0, 8)}...`));
      
    } catch (error) {
      spinner.fail('Validation failed');
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${errorMessage}`));
      process.exit(1);
    }
  });

program
  .command('list-tools')
  .description('List all available AWS tools')
  .action(async () => {
    try {
      const { tools } = await import('@ddegtyarev/aws-tools');
      
      console.log(chalk.blue('Available AWS Tools:\n'));
      
      tools.forEach((tool: any, index: number) => {
        console.log(chalk.gray(`${index + 1}. ${tool.name} - ${tool.description}`));
        console.log('');
      });
      
      console.log(chalk.green(`Total: ${tools.length} tools available`));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${errorMessage}`));
      process.exit(1);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('Invalid command: %s'), program.args.join(' '));
  console.log(chalk.yellow('See --help for a list of available commands.'));
  process.exit(1);
});

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log(chalk.blue('\nQuick start:'));
  console.log(chalk.gray('  1. aws-cost-analyzer init          # Create credentials file'));
  console.log(chalk.gray('  2. aws-cost-analyzer validate      # Test credentials'));
  console.log(chalk.gray('  3. aws-cost-analyzer analyze       # Run full analysis'));
  console.log(chalk.blue('\nDirect step analysis:'));
  console.log(chalk.gray('  aws-cost-analyzer analyze-step -s "AWS Lambda" -r "us-east-1" -t "awsGetCostAndUsage,awsCloudWatchGetMetrics"'));
  console.log(chalk.gray('  aws-cost-analyzer analyze-step -s "Amazon S3" -r "us-west-2" -c "150.50" -t "awsGetCostAndUsage"'));
  console.log(chalk.blue('\nUtility commands:'));
  console.log(chalk.gray('  aws-cost-analyzer list-tools       # List all available AWS tools'));
}

program.parse(process.argv); 