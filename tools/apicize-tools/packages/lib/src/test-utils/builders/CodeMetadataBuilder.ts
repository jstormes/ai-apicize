/**
 * Test data builder for CodeMetadata entities
 * Provides fluent interface for creating metadata data
 */

import { CodeMetadata } from '../../domain/test-analysis/entities/CodeMetadata';
import { ParsedComment, ParsedAnnotation } from '../../infrastructure/parsing/ParsedSource';

/**
 * Builder for creating CodeMetadata instances with fluent interface
 */
export class CodeMetadataBuilder {
  private extractedComments: ParsedComment[] = [];
  private annotations: ParsedAnnotation[] = [];
  private additionalData: Record<string, any> = {};

  /**
   * Set extracted comments
   * @param comments Array of parsed comments
   * @returns Builder instance for chaining
   */
  withComments(comments: ParsedComment[]): this {
    this.extractedComments = comments;
    return this;
  }

  /**
   * Add a single comment
   * @param comment Parsed comment
   * @returns Builder instance for chaining
   */
  withComment(comment: ParsedComment): this {
    this.extractedComments.push(comment);
    return this;
  }

  /**
   * Add a comment with simple parameters
   * @param type Comment type
   * @param content Comment content
   * @param start Start position
   * @param end End position
   * @returns Builder instance for chaining
   */
  withSimpleComment(type: string, content: string, start: number = 0, end: number = 100): this {
    this.extractedComments.push(new ParsedComment(type, content, start, end));
    return this;
  }

  /**
   * Set annotations
   * @param annotations Array of parsed annotations
   * @returns Builder instance for chaining
   */
  withAnnotations(annotations: ParsedAnnotation[]): this {
    this.annotations = annotations;
    return this;
  }

  /**
   * Add a single annotation
   * @param annotation Parsed annotation
   * @returns Builder instance for chaining
   */
  withAnnotation(annotation: ParsedAnnotation): this {
    this.annotations.push(annotation);
    return this;
  }

  /**
   * Add an annotation with simple parameters
   * @param name Annotation name
   * @param value Annotation value
   * @param position Position in source
   * @returns Builder instance for chaining
   */
  withSimpleAnnotation(name: string, value: any, position: number = 0): this {
    this.annotations.push(new ParsedAnnotation(name, value, position));
    return this;
  }

  /**
   * Set additional metadata data
   * @param data Additional data object
   * @returns Builder instance for chaining
   */
  withAdditionalData(data: Record<string, any>): this {
    this.additionalData = data;
    return this;
  }

  /**
   * Add a single additional data property
   * @param key Property key
   * @param value Property value
   * @returns Builder instance for chaining
   */
  withDataProperty(key: string, value: any): this {
    this.additionalData[key] = value;
    return this;
  }

  /**
   * Build the CodeMetadata instance
   * @returns Constructed CodeMetadata
   */
  build(): CodeMetadata {
    const result = CodeMetadata.create({
      id: 'test-metadata',
      sourceFile: 'test.ts'
    });

    if (!result.success) {
      throw new Error(`Failed to create CodeMetadata: ${result.error?.message}`);
    }

    return result.data;
  }

  /**
   * Create a new builder with the same configuration
   * @returns New builder instance
   */
  clone(): CodeMetadataBuilder {
    const builder = new CodeMetadataBuilder();
    builder.extractedComments = [...this.extractedComments];
    builder.annotations = [...this.annotations];
    builder.additionalData = { ...this.additionalData };
    return builder;
  }
}

/**
 * Convenience function to create a CodeMetadataBuilder
 * @returns New CodeMetadataBuilder instance
 */
export function codeMetadata(): CodeMetadataBuilder {
  return new CodeMetadataBuilder();
}

/**
 * Predefined builder configurations for common metadata scenarios
 */
export class CodeMetadataBuilderPresets {
  /**
   * Create metadata with request-specific comments
   * @returns Configured builder
   */
  static withRequestMetadata(): CodeMetadataBuilder {
    return new CodeMetadataBuilder()
      .withSimpleComment(
        'request',
        JSON.stringify({
          id: 'test-request-1',
          method: 'POST',
          url: '/api/users',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
        }),
        0,
        200
      )
      .withSimpleAnnotation('apicize-request', true, 0);
  }

  /**
   * Create metadata with group information
   * @returns Configured builder
   */
  static withGroupMetadata(): CodeMetadataBuilder {
    return new CodeMetadataBuilder()
      .withSimpleComment(
        'group',
        JSON.stringify({
          id: 'test-group-1',
          name: 'User Management',
          execution: 'SEQUENTIAL',
        }),
        100,
        300
      )
      .withSimpleAnnotation('apicize-group', true, 100);
  }

  /**
   * Create empty metadata
   * @returns Empty metadata builder
   */
  static empty(): CodeMetadataBuilder {
    return new CodeMetadataBuilder();
  }

  /**
   * Create metadata with multiple comment types
   * @returns Configured builder with various comments
   */
  static comprehensive(): CodeMetadataBuilder {
    return new CodeMetadataBuilder()
      .withSimpleComment(
        'request',
        JSON.stringify({
          id: 'request-1',
          method: 'GET',
          url: '/api/users/{{userId}}',
        }),
        0,
        150
      )
      .withSimpleComment(
        'group',
        JSON.stringify({
          id: 'group-1',
          name: 'User Tests',
        }),
        200,
        300
      )
      .withSimpleComment(
        'file',
        JSON.stringify({
          version: '1.0',
          source: 'user-tests.spec.ts',
        }),
        400,
        500
      )
      .withSimpleAnnotation('apicize-request', true, 0)
      .withSimpleAnnotation('apicize-group', true, 200)
      .withDataProperty('hasMetadata', true)
      .withDataProperty('extractionTimestamp', new Date().toISOString());
  }

  /**
   * Create metadata with invalid/malformed comments
   * @returns Builder with problematic metadata
   */
  static withInvalidMetadata(): CodeMetadataBuilder {
    return new CodeMetadataBuilder()
      .withSimpleComment('request', '{ invalid json content', 0, 50)
      .withSimpleComment('group', '', 100, 100)
      .withSimpleAnnotation('malformed', undefined, 200)
      .withDataProperty('hasErrors', true);
  }

  /**
   * Create metadata for nested test structures
   * @returns Builder with nested metadata
   */
  static nested(): CodeMetadataBuilder {
    return new CodeMetadataBuilder()
      .withSimpleComment(
        'file',
        JSON.stringify({
          version: '1.0',
          structure: 'nested',
          maxDepth: 3,
        }),
        0,
        100
      )
      .withSimpleComment(
        'group',
        JSON.stringify({
          id: 'parent-group',
          children: ['child-group-1', 'child-group-2'],
        }),
        150,
        250
      )
      .withSimpleAnnotation('nested-structure', true, 0)
      .withDataProperty('isNested', true)
      .withDataProperty('nestingLevel', 3);
  }
}
