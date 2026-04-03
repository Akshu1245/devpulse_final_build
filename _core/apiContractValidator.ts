/**
 * DevPulse API Contract Validator
 * 
 * Validates API implementations against OpenAPI specifications.
 * Detects breaking changes and schema violations.
 * 
 * @module DevPulse/ApiContractValidator
 */

import crypto from 'crypto';

// OpenAPI types (simplified)
export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, Schema>;
    parameters?: Record<string, Parameter>;
    responses?: Record<string, Response>;
  };
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  options?: Operation;
  head?: Operation;
  parameters?: Parameter[];
}

export interface Operation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  tags?: string[];
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: Schema;
  style?: string;
  explode?: boolean;
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, MediaType>;
}

export interface MediaType {
  schema?: Schema;
  example?: any;
  examples?: Record<string, { value: any }>;
}

export interface Response {
  description: string;
  headers?: Record<string, Parameter>;
  content?: Record<string, MediaType>;
}

export interface Schema {
  type?: string;
  format?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  enum?: any[];
  default?: any;
  example?: any;
  $ref?: string;
  allOf?: Schema[];
  anyOf?: Schema[];
  oneOf?: Schema[];
  not?: Schema;
  additionalProperties?: boolean | Schema;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  // OpenAPI specific fields
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  statistics: {
    endpointsValidated: number;
    schemasValidated: number;
    breakingChanges: number;
    violations: number;
  };
}

export interface ValidationError {
  type: 'missing_endpoint' | 'missing_parameter' | 'invalid_parameter' | 'invalid_schema' | 'breaking_change';
  severity: 'error' | 'warning';
  endpoint?: string;
  method?: string;
  message: string;
  path?: string;
  details?: any;
}

export interface ValidationWarning {
  type: string;
  message: string;
  path?: string;
}

// Breaking change types
export type BreakingChangeType =
  | 'endpoint_removed'
  | 'parameter_removed'
  | 'parameter_required_added'
  | 'parameter_type_changed'
  | 'response_schema_changed'
  | 'schema_changed'
  | 'status_code_removed'
  | 'required_property_added'
  | 'property_type_changed';

// Contract comparison result
export interface ContractDiff {
  added: {
    endpoints: string[];
    parameters: string[];
    schemas: string[];
  };
  removed: {
    endpoints: string[];
    parameters: string[];
    schemas: string[];
  };
  modified: {
    endpoints: string[];
    parameters: string[];
    schemas: string[];
  };
  breakingChanges: BreakingChange[];
}

export interface BreakingChange {
  type: BreakingChangeType;
  path: string;
  description: string;
  before?: any;
  after?: any;
}

/**
 * API Contract Validator
 */
export class ApiContractValidator {
  /**
   * Validate actual API responses against OpenAPI spec
   */
  async validateApiResponses(
    spec: OpenAPISpec,
    actualResponses: Map<string, ActualResponse>
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let schemasValidated = 0;

    for (const [endpointKey, actual] of actualResponses) {
      const [method, path] = endpointKey.split(' ');
      const pathItem = this.findPath(spec, path);

      if (!pathItem) {
        errors.push({
          type: 'missing_endpoint',
          severity: 'error',
          endpoint: path,
          method: method.toUpperCase(),
          message: `Endpoint ${method.toUpperCase()} ${path} not found in specification`,
        });
        continue;
      }

      const operation = this.getOperation(pathItem, method);
      if (!operation) {
        errors.push({
          type: 'missing_endpoint',
          severity: 'error',
          endpoint: path,
          method: method.toUpperCase(),
          message: `Method ${method.toUpperCase()} not defined for ${path}`,
        });
        continue;
      }

      // Validate status code
      const response = operation.responses[actual.statusCode];
      if (!response) {
        const availableCodes = Object.keys(operation.responses);
        errors.push({
          type: 'invalid_schema',
          severity: 'error',
          endpoint: path,
          method: method.toUpperCase(),
          message: `Unexpected status code ${actual.statusCode}. Expected: ${availableCodes.join(', ')}`,
          details: { availableStatusCodes: availableCodes },
        });
      }

      // Validate response body
      if (response?.content && actual.body) {
        const contentType = Object.keys(response.content)[0];
        const schema = response.content[contentType]?.schema;

        if (schema) {
          const schemaErrors = this.validateSchema(schema, actual.body, path);
          errors.push(...schemaErrors.map(e => ({
            ...e,
            endpoint: path,
            method: method.toUpperCase(),
          })));
          schemasValidated++;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      statistics: {
        endpointsValidated: actualResponses.size,
        schemasValidated,
        breakingChanges: 0,
        violations: errors.length,
      },
    };
  }

  /**
   * Compare two OpenAPI specs to find breaking changes
   */
  compareSpecs(oldSpec: OpenAPISpec, newSpec: OpenAPISpec): ContractDiff {
    const diff: ContractDiff = {
      added: { endpoints: [], parameters: [], schemas: [] },
      removed: { endpoints: [], parameters: [], schemas: [] },
      modified: { endpoints: [], parameters: [], schemas: [] },
      breakingChanges: [],
    };

    // Compare endpoints
    const oldEndpoints = this.getAllEndpoints(oldSpec);
    const newEndpoints = this.getAllEndpoints(newSpec);

    for (const endpoint of newEndpoints) {
      if (!oldEndpoints.has(endpoint)) {
        diff.added.endpoints.push(endpoint);
      }
    }

    for (const endpoint of oldEndpoints) {
      if (!newEndpoints.has(endpoint)) {
        diff.removed.endpoints.push(endpoint);
        diff.breakingChanges.push({
          type: 'endpoint_removed',
          path: endpoint,
          description: `Endpoint ${endpoint} was removed`,
        });
      }
    }

    // Compare parameters for common endpoints
    for (const endpoint of oldEndpoints) {
      if (newEndpoints.has(endpoint)) {
        const oldParams = this.getEndpointParameters(oldSpec, endpoint);
        const newParams = this.getEndpointParameters(newSpec, endpoint);

        const paramDiff = this.compareParameters(oldParams, newParams, endpoint);
        diff.modified.parameters.push(...paramDiff.modified);
        diff.breakingChanges.push(...paramDiff.breakingChanges);
      }
    }

    // Compare schemas
    const oldSchemas = Object.keys(oldSpec.components?.schemas || {});
    const newSchemas = Object.keys(newSpec.components?.schemas || {});

    for (const schema of newSchemas) {
      if (!oldSchemas.includes(schema)) {
        diff.added.schemas.push(schema);
      }
    }

    for (const schema of oldSchemas) {
      if (!newSchemas.includes(schema)) {
        diff.removed.schemas.push(schema);
        diff.breakingChanges.push({
          type: 'schema_changed',
          path: `#/components/schemas/${schema}`,
          description: `Schema ${schema} was removed`,
        });
      }
    }

    return diff;
  }

  /**
   * Validate a single value against a schema
   */
  validateSchema(schema: Schema, value: any, path: string = ''): ValidationError[] {
    const errors: ValidationError[] = [];

    // Handle $ref
    if (schema.$ref) {
      // Would resolve ref in full implementation
      return errors;
    }

    // Handle allOf, anyOf, oneOf
    if (schema.allOf) {
      for (const subSchema of schema.allOf) {
        errors.push(...this.validateSchema(subSchema, value, path));
      }
      return errors;
    }

    if (schema.anyOf || schema.oneOf) {
      const schemas = schema.anyOf || schema.oneOf;
      const matches = schemas?.some(s => this.validateSchema(s, value, path).length === 0);
      if (!matches) {
        errors.push({
          type: 'invalid_schema',
          severity: 'error',
          message: `Value at ${path} does not match any of the allowed schemas`,
          path,
          details: { allowedSchemas: schemas?.length },
        });
      }
      return errors;
    }

    // Handle not
    if (schema.not) {
      const notErrors = this.validateSchema(schema.not, value, path);
      if (notErrors.length === 0) {
        errors.push({
          type: 'invalid_schema',
          severity: 'error',
          message: `Value at ${path} matches the forbidden schema`,
          path,
        });
      }
      return errors;
    }

    // Type validation
    const type = schema.type;
    if (type) {
      if (type === 'string') {
        if (typeof value !== 'string') {
          errors.push({
            type: 'invalid_schema',
            severity: 'error',
            message: `Expected string at ${path}, got ${typeof value}`,
            path,
          });
        } else {
          // Format validation
          if (schema.format === 'date-time' && isNaN(Date.parse(value))) {
            errors.push({
              type: 'invalid_schema',
              severity: 'error',
              message: `Invalid datetime format at ${path}`,
              path,
            });
          }
          if (schema.format === 'email' && !this.isValidEmail(value)) {
            errors.push({
              type: 'invalid_schema',
              severity: 'error',
              message: `Invalid email format at ${path}`,
              path,
            });
          }
          if (schema.format === 'uri' && !this.isValidUri(value)) {
            errors.push({
              type: 'invalid_schema',
              severity: 'error',
              message: `Invalid URI at ${path}`,
              path,
            });
          }
          // Pattern validation
          if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
            errors.push({
              type: 'invalid_schema',
              severity: 'error',
              message: `Value at ${path} does not match pattern ${schema.pattern}`,
              path,
            });
          }
          // Enum validation
          if (schema.enum && !schema.enum.includes(value)) {
            errors.push({
              type: 'invalid_schema',
              severity: 'error',
              message: `Value at ${path} must be one of: ${schema.enum.join(', ')}`,
              path,
              details: { enum: schema.enum },
            });
          }
        }
      } else if (type === 'number' || type === 'integer') {
        if (typeof value !== 'number') {
          errors.push({
            type: 'invalid_schema',
            severity: 'error',
            message: `Expected number at ${path}, got ${typeof value}`,
            path,
          });
        } else {
          if (schema.minimum !== undefined && value < schema.minimum) {
            errors.push({
              type: 'invalid_schema',
              severity: 'error',
              message: `Value at ${path} must be >= ${schema.minimum}`,
              path,
            });
          }
          if (schema.maximum !== undefined && value > schema.maximum) {
            errors.push({
              type: 'invalid_schema',
              severity: 'error',
              message: `Value at ${path} must be <= ${schema.maximum}`,
              path,
            });
          }
          if (type === 'integer' && !Number.isInteger(value)) {
            errors.push({
              type: 'invalid_schema',
              severity: 'error',
              message: `Value at ${path} must be an integer`,
              path,
            });
          }
        }
      } else if (type === 'boolean') {
        if (typeof value !== 'boolean') {
          errors.push({
            type: 'invalid_schema',
            severity: 'error',
            message: `Expected boolean at ${path}, got ${typeof value}`,
            path,
          });
        }
      } else if (type === 'array') {
        if (!Array.isArray(value)) {
          errors.push({
            type: 'invalid_schema',
            severity: 'error',
            message: `Expected array at ${path}, got ${typeof value}`,
            path,
          });
        } else {
          if (schema.minItems !== undefined && value.length < schema.minItems) {
            errors.push({
              type: 'invalid_schema',
              severity: 'error',
              message: `Array at ${path} must have at least ${schema.minItems} items`,
              path,
            });
          }
          if (schema.maxItems !== undefined && value.length > schema.maxItems) {
            errors.push({
              type: 'invalid_schema',
              severity: 'error',
              message: `Array at ${path} must have at most ${schema.maxItems} items`,
              path,
            });
          }
          if (schema.items) {
            for (let i = 0; i < value.length; i++) {
              errors.push(...this.validateSchema(schema.items, value[i], `${path}[${i}]`));
            }
          }
        }
      } else if (type === 'object') {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push({
            type: 'invalid_schema',
            severity: 'error',
            message: `Expected object at ${path}, got ${typeof value}`,
            path,
          });
        } else {
          // Validate properties
          if (schema.properties) {
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
              if (value[propName] !== undefined) {
                errors.push(...this.validateSchema(propSchema, value[propName], `${path}.${propName}`));
              } else if (schema.required?.includes(propName)) {
                errors.push({
                  type: 'invalid_schema',
                  severity: 'error',
                  message: `Missing required property ${propName} at ${path}`,
                  path: `${path}.${propName}`,
                });
              }
            }
          }
          // Check for additional properties
          if (schema.additionalProperties === false && schema.properties) {
            const allowedProps = new Set(Object.keys(schema.properties));
            for (const propName of Object.keys(value)) {
              if (!allowedProps.has(propName)) {
                errors.push({
                  type: 'invalid_schema',
                  severity: 'warning',
                  message: `Additional property ${propName} at ${path} is not allowed`,
                  path: `${path}.${propName}`,
                });
              }
            }
          }
        }
      }
    }

    return errors;
  }

  /**
   * Parse OpenAPI spec from JSON
   */
  parseSpec(json: string): OpenAPISpec {
    try {
      const spec = JSON.parse(json);
      
      // Validate basic structure
      if (!spec.info || !spec.paths) {
        throw new Error('Invalid OpenAPI spec: missing required fields');
      }

      // Support both OpenAPI 3.x and Swagger 2.0
      const version = spec.openapi || spec.swagger;
      if (!version) {
        throw new Error('Invalid spec: missing version');
      }

      return spec as OpenAPISpec;
    } catch (error) {
      throw new Error(`Failed to parse OpenAPI spec: ${error}`);
    }
  }

  /**
   * Generate mock data from schema
   */
  generateMock(schema: Schema, depth: number = 0): any {
    if (depth > 10) return null; // Prevent infinite recursion

    if (schema.$ref) {
      // Would resolve ref in full implementation
      return null;
    }

    if (schema.example !== undefined) {
      return schema.example;
    }

    if (schema.default !== undefined) {
      return schema.default;
    }

    const type = schema.type || 'string';

    switch (type) {
      case 'string':
        if (schema.enum) {
          return schema.enum[0];
        }
        if (schema.format === 'date-time') {
          return new Date().toISOString();
        }
        if (schema.format === 'date') {
          return new Date().toISOString().split('T')[0];
        }
        if (schema.format === 'email') {
          return 'user@example.com';
        }
        if (schema.format === 'uri') {
          return 'https://example.com';
        }
        if (schema.format === 'uuid') {
          return crypto.randomUUID();
        }
        return 'string';

      case 'number':
      case 'integer':
        if (schema.enum) {
          return schema.enum[0];
        }
        if (schema.minimum !== undefined && schema.maximum !== undefined) {
          return Math.floor((schema.minimum + schema.maximum) / 2);
        }
        return schema.type === 'integer' ? 42 : 3.14;

      case 'boolean':
        return true;

      case 'array':
        if (schema.items) {
          return [this.generateMock(schema.items, depth + 1)];
        }
        return [];

      case 'object':
        const obj: Record<string, any> = {};
        if (schema.properties) {
          for (const [key, propSchema] of Object.entries(schema.properties)) {
            obj[key] = this.generateMock(propSchema, depth + 1);
          }
        }
        return obj;

      default:
        return null;
    }
  }

  // Helper methods
  private findPath(spec: OpenAPISpec, path: string): PathItem | undefined {
    // Handle path parameters
    const normalizedPath = path.replace(/\{[^}]+\}/g, '{param}');
    
    for (const specPath of Object.keys(spec.paths)) {
      const normalizedSpecPath = specPath.replace(/\{[^}]+\}/g, '{param}');
      if (normalizedPath === normalizedSpecPath) {
        return spec.paths[specPath];
      }
    }
    return undefined;
  }

  private getOperation(pathItem: PathItem, method: string): Operation | undefined {
    const m = method.toLowerCase() as keyof PathItem;
    return pathItem[m] as Operation | undefined;
  }

  private getAllEndpoints(spec: OpenAPISpec): Set<string> {
    const endpoints = new Set<string>();
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
      for (const method of methods) {
        if (pathItem[method as keyof PathItem]) {
          endpoints.add(`${method.toUpperCase()} ${path}`);
        }
      }
    }
    return endpoints;
  }

  private getEndpointParameters(spec: OpenAPISpec, endpoint: string): Parameter[] {
    const [method, path] = endpoint.split(' ');
    const pathItem = this.findPath(spec, path);
    if (!pathItem) return [];

    const operation = this.getOperation(pathItem, method);
    const pathParams = pathItem.parameters || [];
    const opParams = operation?.parameters || [];

    return [...pathParams, ...opParams];
  }

  private compareParameters(
    oldParams: Parameter[],
    newParams: Parameter[],
    endpoint: string
  ): { modified: string[]; breakingChanges: BreakingChange[] } {
    const modified: string[] = [];
    const breakingChanges: BreakingChange[] = [];

    const oldMap = new Map(oldParams.map(p => [p.name, p]));
    const newMap = new Map(newParams.map(p => [p.name, p]));

    // Check for removed or changed required
    for (const [name, oldParam] of oldMap) {
      const newParam = newMap.get(name);
      if (!newParam) {
        breakingChanges.push({
          type: 'parameter_removed',
          path: `${endpoint}?${name}`,
          description: `Required parameter ${name} was removed`,
        });
        modified.push(`${endpoint}?${name}`);
      } else if (newParam.required && !oldParam.required) {
        breakingChanges.push({
          type: 'parameter_required_added',
          path: `${endpoint}?${name}`,
          description: `Parameter ${name} is now required`,
          before: false,
          after: true,
        });
        modified.push(`${endpoint}?${name}`);
      } else if (oldParam.schema?.type !== newParam.schema?.type) {
        breakingChanges.push({
          type: 'parameter_type_changed',
          path: `${endpoint}?${name}`,
          description: `Parameter ${name} type changed from ${oldParam.schema?.type} to ${newParam.schema?.type}`,
          before: oldParam.schema?.type,
          after: newParam.schema?.type,
        });
        modified.push(`${endpoint}?${name}`);
      }
    }

    return { modified, breakingChanges };
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidUri(uri: string): boolean {
    try {
      new URL(uri);
      return true;
    } catch {
      return false;
    }
  }
}

// Actual API response type
export interface ActualResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}

// Singleton instance
let validator: ApiContractValidator | null = null;

export function getApiContractValidator(): ApiContractValidator {
  if (!validator) {
    validator = new ApiContractValidator();
  }
  return validator;
}

// Convenience functions
export async function validateApiResponses(
  spec: OpenAPISpec,
  responses: Map<string, ActualResponse>
): Promise<ValidationResult> {
  return getApiContractValidator().validateApiResponses(spec, responses);
}

export function compareApiSpecs(
  oldSpec: OpenAPISpec,
  newSpec: OpenAPISpec
): ContractDiff {
  return getApiContractValidator().compareSpecs(oldSpec, newSpec);
}

export function parseOpenApiSpec(json: string): OpenAPISpec {
  return getApiContractValidator().parseSpec(json);
}
