# AWS Cost Analyzer CLI

An AI-powered CLI tool that analyzes AWS account costs and generates detailed markdown reports with charts and insights.

## Features

- 🔍 **Cost Analysis**: Analyzes top AWS service-region combinations by cost
- 🤖 **AI-Powered Insights**: Uses Amazon Bedrock Claude 3.7 Sonnet for intelligent analysis
- 📊 **Visual Charts**: Generates cost visualization charts using Vega-Lite
- 🖼️ **Chart Analysis**: AI analysis of generated charts for deeper insights
- 📝 **Markdown Reports**: Comprehensive reports with recommendations
- ⚡ **CLI Interface**: Easy-to-use command-line interface

## Prerequisites

- Node.js 18.0.0 or higher
- AWS account with cost data
- AWS credentials with Cost Explorer permissions

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd aws-tools-cli
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Link for global usage (optional):
```bash
npm link
```

## Quick Start

1. **Initialize credentials file**:
```bash
aws-cost-analyzer init
```

2. **Update credentials**:
Edit `.aws-creds.json` with your AWS credentials:
```json
{
  "Credentials": {
    "AccessKeyId": "YOUR_AWS_ACCESS_KEY_ID",
    "SecretAccessKey": "YOUR_AWS_SECRET_ACCESS_KEY",
    "SessionToken": "YOUR_SESSION_TOKEN_IF_USING_STS"
  },
  "region": "us-east-1"
}
```

**Note**: Supports both regular AWS credentials and STS temporary credentials.

3. **Validate credentials**:
```bash
aws-cost-analyzer validate
```

4. **Run analysis**:
```bash
aws-cost-analyzer analyze
```

5. **Convert to HTML** (optional):
```bash
npx @11ty/eleventy
```

### Alternative Workflows

**Single service analysis:**
```bash
# List available AWS tools
aws-cost-analyzer list-tools

# Analyze specific service-region
aws-cost-analyzer analyze-step -s "AWS Lambda" -r "us-east-1"
```

**Generate report from existing analysis:**
```bash
aws-cost-analyzer generate-report -e "01K1JNBJM58W2ZP9FEDH8SAM13"
```

## Usage

### Commands

#### `analyze`
Analyze AWS costs and generate a detailed report.

```bash
aws-cost-analyzer analyze [options]
```

**Options:**
- `-c, --credentials <path>`: Path to AWS credentials file (default: `.aws-creds.json`)
- `-o, --output <path>`: Output path for the markdown report (default: `./output/aws-cost-report.md`)
- `-n, --top <number>`: Number of top service-region combinations to analyze (default: `10`)
- `--no-charts`: Disable chart generation
- `--summary-only`: Generate only a summary report

**Examples:**
```bash
# Basic analysis
aws-cost-analyzer analyze

# Analyze top 20 services with custom output
aws-cost-analyzer analyze -n 20 -o ./reports/cost-analysis.md

# Generate summary only
aws-cost-analyzer analyze --summary-only

# Analysis without charts
aws-cost-analyzer analyze --no-charts
```

#### `analyze-step`
Analyze a specific service-region combination with specified tools.

```bash
aws-cost-analyzer analyze-step [options]
```

**Options:**
- `-s, --service <service>`: AWS service name (required)
- `-r, --region <region>`: AWS region (default: `us-east-1`)
- `-c, --cost <cost>`: Service cost (default: `0`)
- `-t, --tools <tools>`: Comma-separated list of tools to use (default: `awsGetCostAndUsage`)
- `-o, --output <path>`: Output path for the markdown report (default: `./output/step-analysis.md`)

**Examples:**
```bash
# Analyze Lambda in us-east-1
aws-cost-analyzer analyze-step -s "AWS Lambda" -r "us-east-1"

# Analyze S3 with specific cost and multiple tools
aws-cost-analyzer analyze-step -s "Amazon S3" -r "us-west-2" -c "150.50" -t "awsGetCostAndUsage,awsCloudWatchGetMetrics"

# Analyze EC2 with custom output
aws-cost-analyzer analyze-step -s "Amazon EC2" -r "eu-west-1" -o "./reports/ec2-analysis.md"
```

#### `list-tools`
List all available AWS tools that can be used with the analyze-step command.

```bash
aws-cost-analyzer list-tools
```

#### `generate-report`
Generate comprehensive report from existing analysis files.

```bash
aws-cost-analyzer generate-report [options]
```

**Options:**
- `-e, --execution-id <id>`: Execution ID to generate report for (required)
- `-o, --output-dir <path>`: Output directory (default: `./output`)

**Examples:**
```bash
# Generate report from existing analysis
aws-cost-analyzer generate-report -e "01K1JNBJM58W2ZP9FEDH8SAM13"

# Generate report with custom output directory
aws-cost-analyzer generate-report -e "01K1JNBJM58W2ZP9FEDH8SAM13" -o "./reports"
```

#### `init`
Create an example AWS credentials file.

```bash
aws-cost-analyzer init [options]
```

**Options:**
- `-o, --output <path>`: Output path for credentials file (default: `.aws-creds.json`)

#### `validate`
Validate AWS credentials and connection.

```bash
aws-cost-analyzer validate [options]
```

**Options:**
- `-c, --credentials <path>`: Path to AWS credentials file (default: `.aws-creds.json`)

## Analysis Flow

The tool supports multiple analysis workflows:

### Full Analysis (`analyze`)
1. **Credential Loading**: Loads AWS credentials from `.aws-creds.json`
2. **Cost Data Retrieval**: Calls `awsCostAndUsage` tool to get service-region combinations
3. **Cost Ranking**: Orders combinations by descending cost
4. **AI Analysis**: For each top-N combination:
   - Executes LLM call with AWS tools and cost context
   - Generates cost analysis and optimization recommendations
   - Creates Vega-Lite chart specifications (if applicable)
5. **Chart Generation**: Converts chart specs to PNG/SVG images
6. **Visual Analysis**: Sends chart images to LLM for additional insights
7. **Report Generation**: Combines all analyses into comprehensive markdown report
8. **Execution Tracking**: Generates unique execution ID for report organization

### Step Analysis (`analyze-step`)
1. **Direct Service Analysis**: Analyze specific service-region combination
2. **Tool Selection**: Use specified AWS tools (e.g., `awsGetCostAndUsage`, `awsCloudWatchGetMetrics`)
3. **Targeted AI Analysis**: Generate focused analysis for the specified service
4. **Individual Report**: Create standalone report for the service-region combination

### Report Generation (`generate-report`)
1. **Existing Data Analysis**: Read previously generated analysis files by execution ID
2. **Comprehensive Compilation**: Combine individual analyses into unified report
3. **Cross-Service Insights**: Generate insights across all analyzed services
4. **Final Report**: Produce executive summary and detailed analysis report

## Output Structure

```
output/
└── <execution-id>/                    # Unique execution folder (e.g., 01K1KBWEDBCEJT5CCMAA8R23WR)
    ├── report.md                      # Comprehensive analysis report
    ├── report.html                    # HTML version of comprehensive report
    ├── <Service>-<region>-analysis.md # Individual service analysis files
    ├── <Service>-<region>-analysis.html # HTML versions of individual analyses
    └── <Service>-<region>/            # Service-specific data folders
        └── <tool-name>/               # Tool-specific results (e.g., awsGetCostAndUsage)
            ├── <ulid>-chart.png       # Generated chart images
            └── <ulid>-data.json       # Raw data from tool execution
```

**Example structure:**
```
output/
└── 01K1KBWEDBCEJT5CCMAA8R23WR/
    ├── report.md
    ├── report.html
    ├── AWS_Lambda-us-east-1-analysis.md
    ├── AWS_Lambda-us-east-1-analysis.html
    ├── AmazonCloudWatch-global-analysis.md
    ├── AmazonCloudWatch-global-analysis.html
    └── AWS_Lambda-us-east-1/
        ├── awsGetCostAndUsage/
        │   ├── 01K1KBXXWV13D9041Y7GHCRPM6-chart.png
        │   └── 01K1KBXXWV13D9041Y7GHCRPM6-data.json
        └── awsCloudWatchGetMetrics/
            ├── 01K1KBXF4BZK50GEGK0NRBNPZN-chart.png
            └── 01K1KBXF4BZK50GEGK0NRBNPZN-data.json
```

## Report Contents

### Main Report (`report.md`)
- Executive summary with total costs across all analyzed services
- Cost overview and key findings
- Links to individual service-region analysis files
- Comprehensive recommendations and next steps
- Methodology and analysis approach

### Individual Service Reports (`<Service>-<region>-analysis.md`)
- Detailed AI-generated cost analysis for specific service-region
- Cost optimization recommendations
- Links to generated charts and raw data
- Service-specific insights and best practices

### Generated Charts and Data
- **Charts**: PNG images with cost visualizations (located in tool subdirectories)
- **Data**: JSON files containing raw AWS API responses and processed data
- **Organization**: Files organized by service-region and tool used
- **Naming**: ULID-based unique identifiers for each chart/data pair

## Configuration

### AWS Credentials
The tool requires AWS credentials with the following permissions:
- `ce:GetCostAndUsage`
- `ce:GetUsageReport`
- `ce:ListCostCategoryDefinitions`

### LLM Configuration
Uses Amazon Bedrock with Claude 3.7 Sonnet model. The model is configured with:
- Region from AWS credentials
- Same access credentials as AWS services
- Optimized prompts for cost analysis

## Development

### Scripts
- `npm run build`: Compile TypeScript to JavaScript
- `npm run dev`: Run in development mode with ts-node
- `npm start`: Run the compiled CLI
- `npm run clean`: Remove build artifacts
- `npm run lint`: Run ESLint

### HTML Report Generation

The tool includes Eleventy integration for converting markdown reports to styled HTML:

```bash
npx @11ty/eleventy
```

This command:
- Reads markdown reports from the `output/` directory
- Applies CloudFix-branded styling via `eleventy/includes/base.njk` template
- Converts `.md` files to `.html` with professional formatting
- Generates styled HTML reports alongside existing markdown files

**Features:**
- Professional CloudFix branding and color scheme
- Responsive design for mobile and desktop viewing
- Optimized for printing and accessibility
- Automatic link conversion from `.md` to `.html` references

**Output:**
HTML files are generated in the same directory structure as the markdown files, making it easy to share professional-looking reports via web browsers.

### Project Structure
```
src/
├── cli.ts              # CLI interface and commands
├── analyzer.ts         # Main analysis orchestrator
├── aws-service.ts      # AWS API integration
├── llm.ts             # LLM service for AI analysis
├── report-generator.ts # Markdown report generation
├── config.ts          # Configuration management
├── tools.ts           # AWS tools integration and AI SDK compatibility
├── chartUtils.ts      # Chart generation utilities (Vega-Lite)
├── types.ts           # TypeScript type definitions
├── index.ts           # Main exports
└── types/
    └── aws-tools.d.ts  # Type definitions for AWS tools package
```

## Troubleshooting

### Common Issues

1. **"Credentials not found"**
   - Ensure `.aws-creds.json` exists and is properly formatted
   - Run `aws-cost-analyzer init` to create example file

2. **"No cost data found"**
   - Verify AWS account has cost data for the specified time period
   - Check AWS credentials have Cost Explorer permissions

3. **"Chart generation failed"**
   - Ensure Vega and Vega-Lite dependencies are installed
   - Check if chart specification from LLM is valid JSON

4. **"LLM analysis failed"**
   - Verify AWS credentials have Bedrock permissions
   - Check if Claude 3.7 Sonnet model is available in your region

5. **"Execution ID not found"**
   - Ensure the execution ID exists in the output directory
   - Check that the analysis completed successfully before generating reports
   - Use `ls output/` to see available execution IDs

6. **"No tools found"**
   - Run `aws-cost-analyzer list-tools` to see available AWS tools
   - Verify tool names are spelled correctly in analyze-step command
   - Check internet connectivity for aws-tools package access

### Debug Mode
Set environment variable for detailed logging:
```bash
DEBUG=true aws-cost-analyzer analyze
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review existing GitHub issues
3. Create a new issue with detailed information 