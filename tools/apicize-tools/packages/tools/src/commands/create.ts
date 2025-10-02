// Create command implementation

import { Command } from 'commander';
import { resolve, basename } from 'path';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import inquirer from 'inquirer';
import { v4 as uuidv4 } from 'uuid';
import {
  createSpinner,
  success,
  warn,
  info,
  verbose,
  handleCliError,
  executeCommand,
} from '../utils/cli-utils';

interface CreateOptions {
  template?: string;
  output?: string;
  overwrite?: boolean;
  interactive?: boolean;
}

export function createCommand(program: Command): void {
  program
    .command('create <name>')
    .description('Create a new .apicize file from template')
    .option('-t, --template <type>', 'template type (basic|rest-crud|graphql)', 'basic')
    .option('-o, --output <file>', 'output file (default: <name>.apicize)')
    .option('--overwrite', 'overwrite existing file')
    .option('-i, --interactive', 'interactive mode with prompts')
    .action(async (name: string, options: CreateOptions) => {
      await executeCommand(() => createAction(name, options), 'Create failed');
    });
}

async function createAction(name: string, options: CreateOptions): Promise<void> {
  const spinner = createSpinner('Creating new .apicize file...');

  try {
    // Determine output file
    const outputFile = options.output ? resolve(options.output) : resolve(`${name}.apicize`);

    verbose(`Output file: ${outputFile}`);

    // Check if file exists
    if (existsSync(outputFile) && !options.overwrite) {
      spinner.fail('Output file already exists');
      warn('Use --overwrite to replace existing file');
      process.exit(1);
    }

    let templateData: any;

    if (options.interactive) {
      spinner.stop();
      templateData = await interactiveCreate(name, options.template || 'basic');
      spinner.start();
    } else {
      templateData = await getTemplate(options.template || 'basic', name);
    }

    spinner.text = 'Writing .apicize file...';

    // Write the file
    await writeFile(outputFile, JSON.stringify(templateData, null, 2), 'utf8');

    spinner.succeed('Created new .apicize file');

    success(`Created "${basename(outputFile)}" using ${options.template || 'basic'} template`);
    info(`File location: ${outputFile}`);
    info(`Template: ${options.template || 'basic'}`);

    // Show next steps
    console.log();
    info('Next steps:');
    console.log('  1. Edit the file to add your API requests');
    console.log('  2. Configure scenarios and authentication');
    console.log(`  3. Run: apicize export ${basename(outputFile)}`);
  } catch (err) {
    handleCliError(err, spinner);
  }
}

async function interactiveCreate(name: string, template: string): Promise<any> {
  console.log();
  info('Interactive mode - please answer the following questions:');
  console.log();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Description of this API test collection:',
      default: `API tests for ${name}`,
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Base URL for API endpoints:',
      default: 'https://api.example.com',
    },
    {
      type: 'confirm',
      name: 'addAuth',
      message: 'Add authentication configuration?',
      default: false,
    },
    {
      type: 'list',
      name: 'authType',
      message: 'Authentication type:',
      choices: ['Basic', 'API Key', 'OAuth2'],
      when: answers => answers.addAuth,
    },
    {
      type: 'confirm',
      name: 'addScenarios',
      message: 'Add environment scenarios (dev, staging, production)?',
      default: true,
    },
  ]);

  return await buildTemplate(template, name, answers);
}

async function getTemplate(templateType: string, name: string): Promise<any> {
  return await buildTemplate(templateType, name, {
    description: `API tests for ${name}`,
    baseUrl: 'https://api.example.com',
    addAuth: false,
    addScenarios: true,
  });
}

async function buildTemplate(templateType: string, _name: string, config: any): Promise<any> {
  const workbook: any = {
    version: 1.0,
    requests: [],
    scenarios: [],
    authorizations: [],
    certificates: [],
    proxies: [],
    data: [],
    defaults: {},
  };

  // Add scenarios if requested
  if (config.addScenarios) {
    workbook.scenarios = [
      {
        id: uuidv4(),
        name: 'Development',
        variables: [
          {
            name: 'baseUrl',
            value: config.baseUrl.replace('api.example.com', 'api-dev.example.com'),
            type: 'TEXT',
          },
          {
            name: 'apiKey',
            value: 'dev-api-key-here',
            type: 'TEXT',
          },
        ],
      },
      {
        id: uuidv4(),
        name: 'Production',
        variables: [
          {
            name: 'baseUrl',
            value: config.baseUrl,
            type: 'TEXT',
          },
          {
            name: 'apiKey',
            value: 'prod-api-key-here',
            type: 'TEXT',
          },
        ],
      },
    ];

    workbook.defaults.selectedScenario = {
      id: workbook.scenarios[0].id,
      name: workbook.scenarios[0].name,
    };
  }

  // Add authentication if requested
  if (config.addAuth) {
    let authConfig: any;

    switch (config.authType) {
      case 'Basic':
        authConfig = {
          id: uuidv4(),
          name: 'Basic Auth',
          type: 'Basic',
          username: 'your-username',
          password: 'your-password',
        };
        break;
      case 'API Key':
        authConfig = {
          id: uuidv4(),
          name: 'API Key',
          type: 'ApiKey',
          header: 'X-API-Key',
          value: '{{apiKey}}',
        };
        break;
      case 'OAuth2':
        authConfig = {
          id: uuidv4(),
          name: 'OAuth2 Client',
          type: 'OAuth2Client',
          accessTokenUrl: '{{baseUrl}}/oauth/token',
          clientId: 'your-client-id',
          clientSecret: 'your-client-secret',
          scope: 'api:read api:write',
        };
        break;
    }

    if (authConfig) {
      workbook.authorizations.push(authConfig);
      workbook.defaults.selectedAuthorization = {
        id: authConfig.id,
        name: authConfig.name,
      };
    }
  }

  // Add template-specific requests
  switch (templateType) {
    case 'rest-crud':
      workbook.requests = await buildRestCrudTemplate(config);
      break;
    case 'graphql':
      workbook.requests = await buildGraphQLTemplate(config);
      break;
    case 'basic':
    default:
      workbook.requests = await buildBasicTemplate(config);
      break;
  }

  return workbook;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function buildBasicTemplate(_config: any): Promise<any[]> {
  const groupId = uuidv4();
  const getRequestId = uuidv4();
  const postRequestId = uuidv4();

  return [
    {
      id: groupId,
      name: 'Basic API Tests',
      children: [
        {
          id: getRequestId,
          name: 'Get Example',
          url: '{{baseUrl}}/example',
          method: 'GET',
          test: `describe('Get Example', () => {
  it('should return 200 status', () => {
    expect(response.status).to.equal(200);
  });

  it('should return JSON response', () => {
    expect(response.body.type).to.equal(BodyType.JSON);
  });
});`,
          headers: [],
          queryStringParams: [],
          timeout: 30000,
          runs: 1,
        },
        {
          id: postRequestId,
          name: 'Post Example',
          url: '{{baseUrl}}/example',
          method: 'POST',
          test: `describe('Post Example', () => {
  it('should return 201 status', () => {
    expect(response.status).to.equal(201);
  });

  it('should return created resource', () => {
    const JSON_body = (response.body.type == BodyType.JSON)
      ? response.body.data
      : expect.fail('Response body is not JSON');

    expect(JSON_body).to.have.property('id');
    output('createdId', JSON_body.id);
  });
});`,
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          body: {
            type: 'JSON',
            data: {
              name: 'Example Item',
              description: 'This is an example',
            },
          },
          queryStringParams: [],
          timeout: 30000,
          runs: 1,
        },
      ],
      execution: 'SEQUENTIAL',
      runs: 1,
    },
  ];
}

async function buildRestCrudTemplate(config: any): Promise<any[]> {
  // Implementation for REST CRUD template
  // This would create a full CRUD suite with Create, Read, Update, Delete operations
  return await buildBasicTemplate(config); // Simplified for now
}

async function buildGraphQLTemplate(config: any): Promise<any[]> {
  // Implementation for GraphQL template
  // This would create GraphQL query and mutation examples
  return await buildBasicTemplate(config); // Simplified for now
}
