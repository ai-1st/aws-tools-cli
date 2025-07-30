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

The tool follows this analysis process:

1. **Credential Loading**: Loads AWS credentials from `.aws-creds.json`
2. **Cost Data Retrieval**: Calls `awsCostAndUsage` tool to get service-region combinations
3. **Cost Ranking**: Orders combinations by descending cost
4. **AI Analysis**: For each combination:
   - Executes LLM call with AWS tools and cost context
   - Generates cost analysis and optimization recommendations
   - Creates Vega-Lite chart specifications (if applicable)
5. **Chart Generation**: Converts chart specs to PNG images
6. **Visual Analysis**: Sends chart images to LLM for additional insights
7. **Report Generation**: Combines all analyses into comprehensive markdown report

## Output Structure

```
output/
├── aws-cost-report.md          # Main detailed report
├── aws-cost-report-summary.md  # Executive summary
└── charts/
    ├── png/
    │   ├── service1-region1-0.png
    │   └── service2-region2-1.png
    └── svg/
        ├── service1-region1-0.svg
        └── service2-region2-1.svg
```

## Report Contents

### Main Report
- Executive summary with total costs
- Cost overview table
- Detailed analysis for each service-region:
  - AI-generated cost analysis
  - Cost visualization charts
  - Chart analysis with insights and recommendations
- Methodology and appendix

### Summary Report
- High-level cost metrics
- Top cost drivers
- Quick optimization wins

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

### Project Structure
```
src/
├── cli.ts              # CLI interface and commands
├── analyzer.ts         # Main analysis orchestrator
├── aws-service.ts      # AWS API integration
├── llm.ts             # LLM service for AI analysis
├── report-generator.ts # Markdown report generation
├── config.ts          # Configuration management
├── types.ts           # TypeScript type definitions
└── index.ts           # Main exports

chartUtils.ts          # Chart generation utilities
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