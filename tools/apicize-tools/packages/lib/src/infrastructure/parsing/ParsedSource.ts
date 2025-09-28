/**
 * Data structure representing parsed TypeScript source code
 * Contains all the extracted elements from the source file
 */

import { TestBlock } from '../../domain/test-analysis/entities/TestBlock';
import { SourceCode } from '../../domain/test-analysis/value-objects/SourceCode';

/**
 * Represents the result of parsing TypeScript source code
 * Contains all extracted elements and their relationships
 */
export class ParsedSource {
  constructor(
    public readonly testBlocks: TestBlock[],
    public readonly imports: ParsedImport[] = [],
    public readonly globalVariables: ParsedVariable[] = [],
    public readonly helperFunctions: ParsedFunction[] = [],
    public readonly sourceCode: SourceCode = SourceCode.create('').data!,
    public readonly metadata: ParsedMetadata = new ParsedMetadata()
  ) {}

  /**
   * Get all test blocks flattened into a single array
   * @returns Array of all test blocks regardless of nesting
   */
  getAllTestBlocks(): TestBlock[] {
    const flattened: TestBlock[] = [];

    const flatten = (blocks: readonly TestBlock[]) => {
      for (const block of blocks) {
        flattened.push(block);
        if (block.children && block.children.length > 0) {
          flatten(block.children);
        }
      }
    };

    flatten(this.testBlocks);
    return flattened;
  }

  /**
   * Find test blocks by name pattern
   * @param pattern Regular expression or string to match against test names
   * @returns Array of matching test blocks
   */
  findTestBlocks(pattern: string | RegExp): TestBlock[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    return this.getAllTestBlocks().filter(block => regex.test(block.name.value));
  }

  /**
   * Get statistics about the parsed source
   * @returns Object containing parsing statistics
   */
  getStatistics() {
    const allBlocks = this.getAllTestBlocks();
    const describeBlocks = allBlocks.filter(block => block.type === 'describe');
    const itBlocks = allBlocks.filter(block => block.type === 'it');

    return {
      totalTestBlocks: allBlocks.length,
      describeBlocks: describeBlocks.length,
      itBlocks: itBlocks.length,
      importsCount: this.imports.length,
      globalVariablesCount: this.globalVariables.length,
      helperFunctionsCount: this.helperFunctions.length,
      maxNestingDepth: Math.max(0, ...allBlocks.map(block => block.depth)),
    };
  }
}

/**
 * Represents an import statement found in the source code
 */
export class ParsedImport {
  constructor(
    public readonly source: string,
    public readonly imports: string[],
    public readonly isTypeImport: boolean,
    public readonly fullStatement: string
  ) {}
}

/**
 * Represents a global variable declaration found in the source code
 */
export class ParsedVariable {
  constructor(
    public readonly name: string,
    public readonly type: string,
    public readonly value: string | undefined,
    public readonly isConst: boolean,
    public readonly lineNumber: number
  ) {}
}

/**
 * Represents a helper function found in the source code
 */
export class ParsedFunction {
  constructor(
    public readonly name: string,
    public readonly parameters: string[],
    public readonly returnType: string,
    public readonly code: string,
    public readonly lineNumber: number,
    public readonly isAsync: boolean
  ) {}
}

/**
 * Represents metadata extracted from the source code
 */
export class ParsedMetadata {
  constructor(
    public readonly comments: ParsedComment[] = [],
    public readonly annotations: ParsedAnnotation[] = []
  ) {}

  /**
   * Find metadata comments by type
   * @param type The type of metadata comment to find
   * @returns Array of matching comments
   */
  findCommentsByType(type: string): ParsedComment[] {
    return this.comments.filter(comment => comment.type === type);
  }
}

/**
 * Represents a metadata comment found in the source code
 */
export class ParsedComment {
  constructor(
    public readonly type: string,
    public readonly content: string,
    public readonly startPosition: number,
    public readonly endPosition: number
  ) {}
}

/**
 * Represents an annotation found in the source code
 */
export class ParsedAnnotation {
  constructor(
    public readonly name: string,
    public readonly value: any,
    public readonly position: number
  ) {}
}
