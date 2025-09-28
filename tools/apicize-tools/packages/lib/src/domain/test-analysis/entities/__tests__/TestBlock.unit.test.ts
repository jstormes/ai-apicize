/**
 * Unit tests for TestBlock domain entity
 * Tests domain logic in isolation using Phase 3 architecture
 */

import { TestBlock } from '../TestBlock';
import { TestName } from '../../value-objects/TestName';
import { SourceCode } from '../../value-objects/SourceCode';
import { SourcePosition } from '../../value-objects/SourcePosition';
import { TestBlockBuilder, testHelpers } from '../../../../test-utils';

describe('TestBlock (Unit Tests)', () => {
  const { assertions } = testHelpers;

  describe('constructor', () => {
    it('should create a valid test block with required properties', () => {
      const name = new TestName('Test Name');
      const code = new SourceCode('expect(true).to.be.true;');
      const position = new SourcePosition(0, 100, 1);

      const testBlock = new TestBlock('it', name, code, position, 0, [], false);

      assertions.testBlock.hasValidStructure(testBlock);
      expect(testBlock.type).toBe('it');
      expect(testBlock.name).toBe(name);
      expect(testBlock.code).toBe(code);
      expect(testBlock.position).toBe(position);
      expect(testBlock.depth).toBe(0);
      expect(testBlock.children).toEqual([]);
      expect(testBlock.isRequestSpecific).toBe(false);
    });

    it('should create a describe block with children', () => {
      const child = new TestBlockBuilder().asIt('child test').withDepth(1).build();

      const parent = new TestBlockBuilder()
        .asDescribe('parent suite')
        .withDepth(0)
        .withChildren([child])
        .build();

      assertions.testBlock.hasProperties(parent, {
        type: 'describe',
        name: 'parent suite',
        depth: 0,
        hasChildren: true,
        childrenCount: 1,
      });

      assertions.testBlock.hasValidStructure(parent);
      assertions.testBlock.hasValidStructure(child);
    });

    it('should handle request-specific test blocks', () => {
      const requestTest = new TestBlockBuilder()
        .asIt('should make API request')
        .asRequestSpecific(true)
        .withCode('expect(response.status).to.equal(200);')
        .build();

      assertions.testBlock.hasProperties(requestTest, {
        type: 'it',
        isRequestSpecific: true,
      });

      assertions.testBlock.containsCodePatterns(requestTest, ['response.status', 'expect']);
    });
  });

  describe('addChild', () => {
    it('should add a child test block', () => {
      const parent = new TestBlockBuilder().asDescribe('parent').build();

      const child = new TestBlockBuilder().asIt('child').build();

      parent.addChild(child);

      expect(parent.children).toContain(child);
      expect(parent.children).toHaveLength(1);
    });

    it('should maintain children array integrity', () => {
      const parent = new TestBlockBuilder().asDescribe('parent').build();

      const child1 = new TestBlockBuilder().asIt('child 1').build();
      const child2 = new TestBlockBuilder().asIt('child 2').build();

      parent.addChild(child1);
      parent.addChild(child2);

      expect(parent.children).toHaveLength(2);
      expect(parent.children[0]).toBe(child1);
      expect(parent.children[1]).toBe(child2);
    });
  });

  describe('setDepth', () => {
    it('should update the depth of a test block', () => {
      const testBlock = new TestBlockBuilder().withDepth(0).build();

      testBlock.setDepth(2);

      expect(testBlock.depth).toBe(2);
    });

    it('should handle depth changes correctly', () => {
      const testBlock = new TestBlockBuilder().withDepth(1).build();

      testBlock.setDepth(0);
      expect(testBlock.depth).toBe(0);

      testBlock.setDepth(5);
      expect(testBlock.depth).toBe(5);
    });
  });

  describe('domain behavior', () => {
    it('should preserve immutability of value objects', () => {
      const originalName = new TestName('Original Name');
      const originalCode = new SourceCode('original code');
      const originalPosition = new SourcePosition(0, 50, 1);

      const testBlock = new TestBlock(
        'it',
        originalName,
        originalCode,
        originalPosition,
        0,
        [],
        false
      );

      // The test block should hold references to the same value objects
      expect(testBlock.name).toBe(originalName);
      expect(testBlock.code).toBe(originalCode);
      expect(testBlock.position).toBe(originalPosition);

      // Value objects should be immutable
      expect(testBlock.name.value).toBe('Original Name');
      expect(testBlock.code.value).toBe('original code');
    });

    it('should support complex hierarchical structures', () => {
      const level3Test = new TestBlockBuilder().asIt('level 3 test').withDepth(3).build();

      const level2Suite = new TestBlockBuilder()
        .asDescribe('level 2 suite')
        .withDepth(2)
        .withChildren([level3Test])
        .build();

      const level1Suite = new TestBlockBuilder()
        .asDescribe('level 1 suite')
        .withDepth(1)
        .withChildren([level2Suite])
        .build();

      const rootSuite = new TestBlockBuilder()
        .asDescribe('root suite')
        .withDepth(0)
        .withChildren([level1Suite])
        .build();

      assertions.testBlock.hasValidHierarchy([rootSuite]);

      // Verify hierarchy
      expect(rootSuite.children).toHaveLength(1);
      expect(rootSuite.children[0]).toBe(level1Suite);
      expect(level1Suite.children[0]).toBe(level2Suite);
      expect(level2Suite.children[0]).toBe(level3Test);
    });

    it('should distinguish between different test types', () => {
      const itBlock = new TestBlockBuilder().asIt('individual test').build();

      const describeBlock = new TestBlockBuilder().asDescribe('test suite').build();

      expect(itBlock.type).toBe('it');
      expect(describeBlock.type).toBe('describe');

      assertions.testBlock.hasValidStructure(itBlock);
      assertions.testBlock.hasValidStructure(describeBlock);
    });

    it('should handle request-specific classification correctly', () => {
      const requestSpecificTest = new TestBlockBuilder()
        .asIt('API endpoint test')
        .asRequestSpecific(true)
        .withCode(
          `
          expect(response.status).to.equal(200);
          expect(response.body.data).to.exist;
        `
        )
        .build();

      const sharedTest = new TestBlockBuilder()
        .asIt('utility function test')
        .asRequestSpecific(false)
        .withCode(
          `
          expect(validateEmail('test@example.com')).to.be.true;
        `
        )
        .build();

      expect(requestSpecificTest.isRequestSpecific).toBe(true);
      expect(sharedTest.isRequestSpecific).toBe(false);

      assertions.testBlock.containsCodePatterns(requestSpecificTest, [
        'response.status',
        'response.body',
      ]);

      assertions.testBlock.containsCodePatterns(sharedTest, ['validateEmail']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty test names gracefully', () => {
      const testBlock = new TestBlockBuilder().withName('').build();

      expect(testBlock.name.value).toBe('');
      // Should still be structurally valid except for empty name
      expect(testBlock.code).toBeDefined();
      expect(testBlock.position).toBeDefined();
    });

    it('should handle empty code gracefully', () => {
      const testBlock = new TestBlockBuilder().withCode('').build();

      expect(testBlock.code.value).toBe('');
      assertions.testBlock.hasValidStructure(testBlock);
    });

    it('should handle deep nesting levels', () => {
      const deepTest = new TestBlockBuilder().asIt('deeply nested test').withDepth(10).build();

      expect(deepTest.depth).toBe(10);
      assertions.testBlock.hasValidStructure(deepTest);
    });

    it('should handle special characters in names and code', () => {
      const specialTest = new TestBlockBuilder()
        .withName('Test with special chars: @#$%^&*()')
        .withCode('expect("🎉").to.be.a("string");')
        .build();

      expect(specialTest.name.value).toContain('@#$%^&*()');
      expect(specialTest.code.value).toContain('🎉');
      assertions.testBlock.hasValidStructure(specialTest);
    });
  });
});
