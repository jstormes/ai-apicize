/**
 * Config Validator - Responsible for validating configuration structures
 */

import { Result, success, failure } from '../../infrastructure/result';
import { ApicizeError, ApicizeErrorCode } from '../../infrastructure/errors';
import {
  ConfigValidator as IConfigValidator,
  ValidationRule,
} from '../../domain/configuration/configuration-domain';
import { ApicizeConfig, EnvironmentConfig, AuthProvidersConfig } from '../../types';

/**
 * Config validator configuration
 */
export interface ConfigValidatorConfig {
  enableStrictValidation?: boolean;
  allowAdditionalProperties?: boolean;
  customRules?: Map<string, ValidationRule>;
  warningCallback?: (message: string) => void;
}

/**
 * Built-in validation rules
 */
export class BuiltInValidationRules {
  static required: ValidationRule = {
    name: 'required',
    validate: (value: unknown) => value !== undefined && value !== null,
    message: 'Field is required',
  };

  static string: ValidationRule = {
    name: 'string',
    validate: (value: unknown) => typeof value === 'string',
    message: 'Field must be a string',
  };

  static number: ValidationRule = {
    name: 'number',
    validate: (value: unknown) => typeof value === 'number',
    message: 'Field must be a number',
  };

  static boolean: ValidationRule = {
    name: 'boolean',
    validate: (value: unknown) => typeof value === 'boolean',
    message: 'Field must be a boolean',
  };

  static object: ValidationRule = {
    name: 'object',
    validate: (value: unknown) =>
      value !== null && typeof value === 'object' && !Array.isArray(value),
    message: 'Field must be an object',
  };

  static array: ValidationRule = {
    name: 'array',
    validate: (value: unknown) => Array.isArray(value),
    message: 'Field must be an array',
  };

  static positiveNumber: ValidationRule = {
    name: 'positiveNumber',
    validate: (value: unknown) => typeof value === 'number' && value > 0,
    message: 'Field must be a positive number',
  };

  static nonEmptyString: ValidationRule = {
    name: 'nonEmptyString',
    validate: (value: unknown) => typeof value === 'string' && value.trim().length > 0,
    message: 'Field must be a non-empty string',
  };

  static semverVersion: ValidationRule = {
    name: 'semverVersion',
    validate: (value: unknown) => {
      if (typeof value !== 'string') return false;
      const semverPattern = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
      return semverPattern.test(value);
    },
    message: 'Field must be a valid semantic version',
  };

  static url: ValidationRule = {
    name: 'url',
    validate: (value: unknown) => {
      if (typeof value !== 'string') return false;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: 'Field must be a valid URL',
  };

  static path: ValidationRule = {
    name: 'path',
    validate: (value: unknown) => {
      if (typeof value !== 'string') return false;
      // Basic path validation - could be more sophisticated
      return value.length > 0 && !value.includes('\x00');
    },
    message: 'Field must be a valid path',
  };
}

/**
 * Config validator implementation
 */
export class ApicizeConfigValidator implements IConfigValidator {
  private config: ConfigValidatorConfig;
  private customRules: Map<string, ValidationRule>;

  constructor(config: ConfigValidatorConfig = {}) {
    this.config = {
      enableStrictValidation: true,
      allowAdditionalProperties: false,
      customRules: new Map(),
      warningCallback: message => console.warn(message),
      ...config,
    };

    this.customRules = new Map(this.config.customRules);
  }

  /**
   * Validate base configuration
   */
  validateBaseConfig(config: unknown): Result<ApicizeConfig, ApicizeError> {
    try {
      // Basic type check
      const objectValidation = this.validateField('config', config, [
        BuiltInValidationRules.object,
      ]);
      if (objectValidation.isFailure()) {
        return objectValidation as any;
      }

      const configObj = config as any;

      // Validate required fields
      const validationResults = [
        this.validateField('version', configObj.version, [
          BuiltInValidationRules.required,
          BuiltInValidationRules.nonEmptyString,
        ]),
        this.validateField('settings', configObj.settings, [
          BuiltInValidationRules.required,
          BuiltInValidationRules.object,
        ]),
      ];

      // Check for validation failures
      for (const result of validationResults) {
        if (result.isFailure()) {
          return result as any;
        }
      }

      // Validate optional fields if present
      if (configObj.activeEnvironment !== undefined) {
        const envValidation = this.validateField('activeEnvironment', configObj.activeEnvironment, [
          BuiltInValidationRules.nonEmptyString,
        ]);
        if (envValidation.isFailure()) {
          return envValidation as any;
        }
      }

      if (configObj.libPath !== undefined) {
        const pathValidation = this.validateField('libPath', configObj.libPath, [
          BuiltInValidationRules.path,
        ]);
        if (pathValidation.isFailure()) {
          return pathValidation as any;
        }
      }

      // Validate settings object
      const settingsValidation = this.validateSettings(configObj.settings);
      if (settingsValidation.isFailure()) {
        return settingsValidation as any;
      }

      // Validate imports section if present
      if (configObj.imports !== undefined) {
        const importsValidation = this.validateImportsConfig(configObj.imports);
        if (importsValidation.isFailure()) {
          return importsValidation as any;
        }
      }

      // Validate exports section if present
      if (configObj.exports !== undefined) {
        const exportsValidation = this.validateExportsConfig(configObj.exports);
        if (exportsValidation.isFailure()) {
          return exportsValidation as any;
        }
      }

      // Check for additional properties if strict mode is enabled
      if (!this.config.allowAdditionalProperties) {
        const allowedFields = [
          'version',
          'activeEnvironment',
          'libPath',
          'configPath',
          'testsPath',
          'dataPath',
          'reportsPath',
          'settings',
          'imports',
          'exports',
        ];
        const additionalFields = Object.keys(configObj).filter(key => !allowedFields.includes(key));
        if (additionalFields.length > 0) {
          this.config.warningCallback?.(
            `Additional properties found in base config: ${additionalFields.join(', ')}`
          );
        }
      }

      return success(configObj as ApicizeConfig);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.VALIDATION_ERROR,
          'Failed to validate base configuration',
          { cause: error as Error }
        )
      );
    }
  }

  /**
   * Validate environment configuration
   */
  validateEnvironmentConfig(config: unknown): Result<EnvironmentConfig, ApicizeError> {
    try {
      const objectValidation = this.validateField('config', config, [
        BuiltInValidationRules.object,
      ]);
      if (objectValidation.isFailure()) {
        return objectValidation as any;
      }

      const configObj = config as any;

      // Validate required fields
      const nameValidation = this.validateField('name', configObj.name, [
        BuiltInValidationRules.required,
        BuiltInValidationRules.nonEmptyString,
      ]);
      if (nameValidation.isFailure()) {
        return nameValidation as any;
      }

      // Validate optional sections
      if (configObj.baseUrls !== undefined) {
        const baseUrlsValidation = this.validateField('baseUrls', configObj.baseUrls, [
          BuiltInValidationRules.object,
        ]);
        if (baseUrlsValidation.isFailure()) {
          return baseUrlsValidation as any;
        }

        // Validate each base URL
        for (const [service, url] of Object.entries(configObj.baseUrls)) {
          const urlValidation = this.validateField(`baseUrls.${service}`, url, [
            BuiltInValidationRules.url,
          ]);
          if (urlValidation.isFailure()) {
            return urlValidation as any;
          }
        }
      }

      if (configObj.headers !== undefined) {
        const headersValidation = this.validateField('headers', configObj.headers, [
          BuiltInValidationRules.object,
        ]);
        if (headersValidation.isFailure()) {
          return headersValidation as any;
        }
      }

      if (configObj.timeouts !== undefined) {
        const timeoutsValidation = this.validateTimeouts(configObj.timeouts);
        if (timeoutsValidation.isFailure()) {
          return timeoutsValidation as any;
        }
      }

      return success(configObj as EnvironmentConfig);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.VALIDATION_ERROR,
          'Failed to validate environment configuration',
          { cause: error as Error }
        )
      );
    }
  }

  /**
   * Validate auth providers configuration
   */
  validateAuthProvidersConfig(config: unknown): Result<AuthProvidersConfig, ApicizeError> {
    try {
      const objectValidation = this.validateField('config', config, [
        BuiltInValidationRules.object,
      ]);
      if (objectValidation.isFailure()) {
        return objectValidation as any;
      }

      const configObj = config as any;

      // Validate providers object
      if (configObj.providers !== undefined) {
        const providersValidation = this.validateField('providers', configObj.providers, [
          BuiltInValidationRules.object,
        ]);
        if (providersValidation.isFailure()) {
          return providersValidation as any;
        }

        // Validate each provider
        for (const [name, provider] of Object.entries(configObj.providers)) {
          const providerValidation = this.validateAuthProvider(name, provider);
          if (providerValidation.isFailure()) {
            return providerValidation as any;
          }
        }
      }

      return success(configObj as AuthProvidersConfig);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.VALIDATION_ERROR,
          'Failed to validate auth providers configuration',
          { cause: error as Error }
        )
      );
    }
  }

  /**
   * Validate a specific field with rules
   */
  validateField(
    fieldName: string,
    value: unknown,
    rules: ValidationRule[]
  ): Result<boolean, ApicizeError> {
    try {
      for (const rule of rules) {
        if (!rule.validate(value)) {
          return failure(
            new ApicizeError(
              ApicizeErrorCode.VALIDATION_ERROR,
              `Validation failed for field '${fieldName}': ${rule.message}`,
              {
                context: {
                  fieldName,
                  value,
                  rule: rule.name,
                  message: rule.message,
                },
              }
            )
          );
        }
      }

      // Check custom rules
      for (const [ruleName, rule] of this.customRules) {
        if (!rule.validate(value)) {
          return failure(
            new ApicizeError(
              ApicizeErrorCode.VALIDATION_ERROR,
              `Custom validation failed for field '${fieldName}': ${rule.message}`,
              {
                context: {
                  fieldName,
                  value,
                  rule: ruleName,
                  message: rule.message,
                },
              }
            )
          );
        }
      }

      return success(true);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.VALIDATION_ERROR,
          `Failed to validate field '${fieldName}'`,
          {
            cause: error as Error,
            context: { fieldName, value },
          }
        )
      );
    }
  }

  /**
   * Add custom validation rule
   */
  addCustomRule(name: string, rule: ValidationRule): void {
    this.customRules.set(name, rule);
  }

  /**
   * Remove custom validation rule
   */
  removeCustomRule(name: string): boolean {
    return this.customRules.delete(name);
  }

  /**
   * Get all custom rules
   */
  getCustomRules(): Map<string, ValidationRule> {
    return new Map(this.customRules);
  }

  // Private validation helper methods

  private validateSettings(settings: any): Result<boolean, ApicizeError> {
    const validations = [];

    if (settings.defaultTimeout !== undefined) {
      validations.push(
        this.validateField('settings.defaultTimeout', settings.defaultTimeout, [
          BuiltInValidationRules.positiveNumber,
        ])
      );
    }

    if (settings.retryAttempts !== undefined) {
      validations.push(
        this.validateField('settings.retryAttempts', settings.retryAttempts, [
          BuiltInValidationRules.number,
        ])
      );
    }

    if (settings.parallelExecution !== undefined) {
      validations.push(
        this.validateField('settings.parallelExecution', settings.parallelExecution, [
          BuiltInValidationRules.boolean,
        ])
      );
    }

    if (settings.verboseLogging !== undefined) {
      validations.push(
        this.validateField('settings.verboseLogging', settings.verboseLogging, [
          BuiltInValidationRules.boolean,
        ])
      );
    }

    if (settings.preserveMetadata !== undefined) {
      validations.push(
        this.validateField('settings.preserveMetadata', settings.preserveMetadata, [
          BuiltInValidationRules.boolean,
        ])
      );
    }

    // Check all validations
    for (const validation of validations) {
      if (validation.isFailure()) {
        return validation;
      }
    }

    return success(true);
  }

  private validateImportsConfig(imports: any): Result<boolean, ApicizeError> {
    const validations = [];

    if (imports.autoGenerateIds !== undefined) {
      validations.push(
        this.validateField('imports.autoGenerateIds', imports.autoGenerateIds, [
          BuiltInValidationRules.boolean,
        ])
      );
    }

    if (imports.validateOnImport !== undefined) {
      validations.push(
        this.validateField('imports.validateOnImport', imports.validateOnImport, [
          BuiltInValidationRules.boolean,
        ])
      );
    }

    if (imports.preserveComments !== undefined) {
      validations.push(
        this.validateField('imports.preserveComments', imports.preserveComments, [
          BuiltInValidationRules.boolean,
        ])
      );
    }

    for (const validation of validations) {
      if (validation.isFailure()) {
        return validation;
      }
    }

    return success(true);
  }

  private validateExportsConfig(exports: any): Result<boolean, ApicizeError> {
    const validations = [];

    if (exports.includeMetadata !== undefined) {
      validations.push(
        this.validateField('exports.includeMetadata', exports.includeMetadata, [
          BuiltInValidationRules.boolean,
        ])
      );
    }

    if (exports.generateHelpers !== undefined) {
      validations.push(
        this.validateField('exports.generateHelpers', exports.generateHelpers, [
          BuiltInValidationRules.boolean,
        ])
      );
    }

    if (exports.splitByGroup !== undefined) {
      validations.push(
        this.validateField('exports.splitByGroup', exports.splitByGroup, [
          BuiltInValidationRules.boolean,
        ])
      );
    }

    for (const validation of validations) {
      if (validation.isFailure()) {
        return validation;
      }
    }

    return success(true);
  }

  private validateTimeouts(timeouts: any): Result<boolean, ApicizeError> {
    const validations = [];

    if (timeouts.default !== undefined) {
      validations.push(
        this.validateField('timeouts.default', timeouts.default, [
          BuiltInValidationRules.positiveNumber,
        ])
      );
    }

    if (timeouts.long !== undefined) {
      validations.push(
        this.validateField('timeouts.long', timeouts.long, [BuiltInValidationRules.positiveNumber])
      );
    }

    for (const validation of validations) {
      if (validation.isFailure()) {
        return validation;
      }
    }

    return success(true);
  }

  private validateAuthProvider(name: string, provider: any): Result<boolean, ApicizeError> {
    const validations = [
      this.validateField(`providers.${name}`, provider, [BuiltInValidationRules.object]),
      this.validateField(`providers.${name}.type`, (provider as any)?.type, [
        BuiltInValidationRules.required,
        BuiltInValidationRules.nonEmptyString,
      ]),
      this.validateField(`providers.${name}.config`, (provider as any)?.config, [
        BuiltInValidationRules.required,
        BuiltInValidationRules.object,
      ]),
    ];

    for (const validation of validations) {
      if (validation.isFailure()) {
        return validation;
      }
    }

    // Validate type-specific configuration
    const type = (provider as any).type;
    const config = (provider as any).config;

    switch (type) {
      case 'Basic':
        return this.validateBasicAuthConfig(name, config);
      case 'OAuth2Client':
        return this.validateOAuth2ClientConfig(name, config);
      case 'OAuth2Pkce':
        return this.validateOAuth2PkceConfig(name, config);
      case 'ApiKey':
        return this.validateApiKeyConfig(name, config);
      default:
        this.config.warningCallback?.(
          `Unknown auth provider type '${type}' for provider '${name}'`
        );
        return success(true);
    }
  }

  private validateBasicAuthConfig(
    providerName: string,
    config: any
  ): Result<boolean, ApicizeError> {
    const validations = [
      this.validateField(`providers.${providerName}.config.username`, config.username, [
        BuiltInValidationRules.required,
        BuiltInValidationRules.nonEmptyString,
      ]),
      this.validateField(`providers.${providerName}.config.password`, config.password, [
        BuiltInValidationRules.required,
        BuiltInValidationRules.string,
      ]),
    ];

    for (const validation of validations) {
      if (validation.isFailure()) {
        return validation;
      }
    }

    return success(true);
  }

  private validateOAuth2ClientConfig(
    providerName: string,
    config: any
  ): Result<boolean, ApicizeError> {
    const validations = [
      this.validateField(`providers.${providerName}.config.accessTokenUrl`, config.accessTokenUrl, [
        BuiltInValidationRules.required,
        BuiltInValidationRules.url,
      ]),
      this.validateField(`providers.${providerName}.config.clientId`, config.clientId, [
        BuiltInValidationRules.required,
        BuiltInValidationRules.nonEmptyString,
      ]),
      this.validateField(`providers.${providerName}.config.clientSecret`, config.clientSecret, [
        BuiltInValidationRules.required,
        BuiltInValidationRules.string,
      ]),
    ];

    for (const validation of validations) {
      if (validation.isFailure()) {
        return validation;
      }
    }

    return success(true);
  }

  private validateOAuth2PkceConfig(
    providerName: string,
    config: any
  ): Result<boolean, ApicizeError> {
    const validations = [
      this.validateField(`providers.${providerName}.config.authorizeUrl`, config.authorizeUrl, [
        BuiltInValidationRules.required,
        BuiltInValidationRules.url,
      ]),
      this.validateField(`providers.${providerName}.config.accessTokenUrl`, config.accessTokenUrl, [
        BuiltInValidationRules.required,
        BuiltInValidationRules.url,
      ]),
      this.validateField(`providers.${providerName}.config.clientId`, config.clientId, [
        BuiltInValidationRules.required,
        BuiltInValidationRules.nonEmptyString,
      ]),
    ];

    for (const validation of validations) {
      if (validation.isFailure()) {
        return validation;
      }
    }

    return success(true);
  }

  private validateApiKeyConfig(providerName: string, config: any): Result<boolean, ApicizeError> {
    const validations = [
      this.validateField(`providers.${providerName}.config.header`, config.header, [
        BuiltInValidationRules.required,
        BuiltInValidationRules.nonEmptyString,
      ]),
      this.validateField(`providers.${providerName}.config.value`, config.value, [
        BuiltInValidationRules.required,
        BuiltInValidationRules.string,
      ]),
    ];

    for (const validation of validations) {
      if (validation.isFailure()) {
        return validation;
      }
    }

    return success(true);
  }

  /**
   * Create a copy with different configuration
   */
  withConfig(newConfig: Partial<ConfigValidatorConfig>): ApicizeConfigValidator {
    const newValidator = new ApicizeConfigValidator({ ...this.config, ...newConfig });

    // Copy custom rules
    for (const [name, rule] of this.customRules) {
      newValidator.addCustomRule(name, rule);
    }

    return newValidator;
  }

  /**
   * Get current configuration
   */
  getConfig(): ConfigValidatorConfig {
    return { ...this.config };
  }
}
