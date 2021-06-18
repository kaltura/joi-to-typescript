import Joi from 'joi';

import { convertSchema } from '../index';

describe('enums tests', () => {
  test('enums using valid()', () => {
    const schema = Joi.object({
      topColour: Joi.string().valid('red', 'green', 'orange', 'blue').required(),
      bottomColour: Joi.string().valid('red', 'green', 'orange', 'blue').required(),
      escape: Joi.string().valid("a'b", 'c"d', "e'f'g", 'h"i"j', '\\\\').required()
    })
      .label('TestSchema')
      .description('a test schema definition');

    const result = convertSchema({ sortPropertiesByName: false }, schema);
    expect(result).not.toBeUndefined;
    expect(result?.content).toBe(`/**
 * a test schema definition
 */
export interface TestSchema {
  topColour: 'red' | 'green' | 'orange' | 'blue';
  bottomColour: 'red' | 'green' | 'orange' | 'blue';
  escape: 'a\\'b' | 'c"d' | 'e\\'f\\'g' | 'h"i"j' | '\\\\\\\\';
}`);
  });

  test('enums using allow()', () => {
    const schema = Joi.object({
      bit: Joi.boolean().allow(0, 1, '0', '1', null)
    })
      .label('TestSchema')
      .description('a test schema definition');

    const result = convertSchema({ defaultToRequired: true }, schema);
    expect(result).not.toBeUndefined;
    expect(result?.content).toBe(`/**
 * a test schema definition
 */
export interface TestSchema {
  bit: 0 | 1 | '0' | '1' | null;
}`);
  });

  test('enum', () => {
    const fooSchema = Joi.string()
      .valid('test1', 'test 2', 'test-3')
      .label('Foo')
      .description('a test schema definition');

    const result = convertSchema({ sortPropertiesByName: false }, fooSchema);
    expect(result).not.toBeUndefined;

    expect(result?.content).toBe(`/**
 * a test schema definition
 */
export enum Foo {
  Test1 = 'test1',
  Test2 = 'test 2',
  Test3 = 'test-3',
}`);
  });

  test('enum in object', () => {
    const fooSchema = Joi.string().valid('test1', 'test 2', 'test-3').label('Foo');

    const schema = Joi.object({
      bit: fooSchema.required()
    })
      .label('TestSchema')
      .description('a test schema definition');

    const result = convertSchema({ sortPropertiesByName: false }, schema);
    expect(result).not.toBeUndefined;

    expect(result?.content).toBe(`/**
 * a test schema definition
 */
export interface TestSchema {
  bit: Foo;
}`);
  });
});
