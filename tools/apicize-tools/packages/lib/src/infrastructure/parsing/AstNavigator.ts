/**
 * AST navigation utility for TypeScript source files
 * Provides high-level methods for traversing the TypeScript AST
 */

import * as ts from 'typescript';

/**
 * Utility class for navigating TypeScript AST nodes
 * Provides common traversal patterns and visitor methods
 */
export class AstNavigator {
  /**
   * Visit all import declarations in the source file
   * @param sourceFile The TypeScript source file
   * @param visitor Callback function called for each import declaration
   */
  visitImportDeclarations(
    sourceFile: ts.SourceFile,
    visitor: (node: ts.ImportDeclaration) => void
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        visitor(node);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  /**
   * Visit all call expressions in the source file
   * @param sourceFile The TypeScript source file
   * @param visitor Callback function called for each call expression
   */
  visitCallExpressions(
    sourceFile: ts.SourceFile,
    visitor: (node: ts.CallExpression) => void
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        visitor(node);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  /**
   * Visit all function declarations in the source file
   * @param sourceFile The TypeScript source file
   * @param visitor Callback function called for each function declaration
   */
  visitFunctionDeclarations(
    sourceFile: ts.SourceFile,
    visitor: (node: ts.FunctionDeclaration) => void
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node)) {
        visitor(node);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  /**
   * Visit all variable declarations in the source file
   * @param sourceFile The TypeScript source file
   * @param visitor Callback function called for each variable declaration
   */
  visitVariableDeclarations(
    sourceFile: ts.SourceFile,
    visitor: (node: ts.VariableDeclaration) => void
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node)) {
        visitor(node);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  /**
   * Find all nodes of a specific type in the source file
   * @param sourceFile The TypeScript source file
   * @param predicate Function to test if a node should be included
   * @returns Array of nodes that match the predicate
   */
  findNodes<T extends ts.Node>(
    sourceFile: ts.SourceFile,
    predicate: (node: ts.Node) => node is T
  ): T[] {
    const results: T[] = [];

    const visit = (node: ts.Node) => {
      if (predicate(node)) {
        results.push(node);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return results;
  }

  /**
   * Find the first node that matches the predicate
   * @param sourceFile The TypeScript source file
   * @param predicate Function to test if a node should be included
   * @returns The first matching node or undefined
   */
  findFirstNode<T extends ts.Node>(
    sourceFile: ts.SourceFile,
    predicate: (node: ts.Node) => node is T
  ): T | undefined {
    let result: T | undefined;

    const visit = (node: ts.Node): boolean => {
      if (predicate(node)) {
        result = node;
        return true; // Stop traversal
      }

      // Continue traversal until found
      return ts.forEachChild(node, visit) || false;
    };

    visit(sourceFile);
    return result;
  }

  /**
   * Get all child nodes of a specific node
   * @param node The parent node
   * @returns Array of all direct children
   */
  getChildren(node: ts.Node): ts.Node[] {
    const children: ts.Node[] = [];
    ts.forEachChild(node, child => {
      children.push(child);
    });
    return children;
  }

  /**
   * Get the text content of a node
   * @param node The TypeScript node
   * @param sourceFile The source file (for getting full text)
   * @returns The text content of the node
   */
  getNodeText(node: ts.Node, sourceFile: ts.SourceFile): string {
    return node.getFullText(sourceFile);
  }

  /**
   * Check if a node is contained within another node
   * @param child The potential child node
   * @param parent The potential parent node
   * @returns True if child is contained within parent
   */
  isNodeContainedIn(child: ts.Node, parent: ts.Node): boolean {
    const childStart = child.getStart();
    const childEnd = child.getEnd();
    const parentStart = parent.getStart();
    const parentEnd = parent.getEnd();

    return childStart >= parentStart && childEnd <= parentEnd;
  }

  /**
   * Get the depth of nesting for a node within the AST
   * @param node The node to check
   * @param sourceFile The root source file
   * @returns The depth level (0 for top-level)
   */
  getNodeDepth(node: ts.Node, sourceFile: ts.SourceFile): number {
    let depth = 0;
    let current = node.parent;

    while (current && current !== sourceFile) {
      depth++;
      current = current.parent;
    }

    return depth;
  }

  /**
   * Find all ancestor nodes of a given node
   * @param node The node to find ancestors for
   * @returns Array of ancestor nodes from immediate parent to root
   */
  getAncestors(node: ts.Node): ts.Node[] {
    const ancestors: ts.Node[] = [];
    let current = node.parent;

    while (current) {
      ancestors.push(current);
      current = current.parent;
    }

    return ancestors;
  }

  /**
   * Find the nearest ancestor of a specific type
   * @param node The starting node
   * @param predicate Function to test if an ancestor matches
   * @returns The nearest matching ancestor or undefined
   */
  findNearestAncestor<T extends ts.Node>(
    node: ts.Node,
    predicate: (node: ts.Node) => node is T
  ): T | undefined {
    let current = node.parent;

    while (current) {
      if (predicate(current)) {
        return current;
      }
      current = current.parent;
    }

    return undefined;
  }
}
