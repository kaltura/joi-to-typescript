import Joi from 'joi';

import { convertSchema } from '../index';

describe('test `Joi.object().pattern()`', () => {
  test('`interface pattern()`', () => {
    const itemSchema = Joi.object({
      nestedRecordProperty: Joi.string()
    }).label('Item');

    const schema = Joi.object({
      stringProp: Joi.string(),
      nested: Joi.object({
        nestedName: Joi.string()
      }),
      nestedPattern: Joi.object().pattern(Joi.string(), itemSchema),
      nestedPattern2: Joi.object()
        .pattern(
          Joi.string(),
          Joi.object({
            test: Joi.number(),
            test1: Joi.string()
          })
        )
        .required()
    })
      .label('TestSchema')
      .description('a test schema definition');

    const result = convertSchema({ sortPropertiesByName: false }, schema);
    expect(result).not.toBeUndefined;

    expect(result?.content).toBe(`/**
 * a test schema definition
 */
export interface TestSchema {
  stringProp?: string;
  nested?: {
    nestedName?: string;
  };
  nestedPattern?: {
    [x: string]: Item;
  };
  nestedPattern2: {
    [x: string]: {
      test?: number;
      test1?: string;
    };
  };
}`);
  });

  test('`with alternatives`', () => {
    const fooSchema = Joi.object({
      foo: Joi.string()
    }).label('Foo');

    const bazSchema = Joi.string().label('Baz');

    const stringSchema = Joi.string();

    const schema = Joi.object({
      test: Joi.object()
        .pattern(
          Joi.string(),
          Joi.alternatives().try(
            fooSchema,
            bazSchema,
            stringSchema,
            Joi.object({
              bar: Joi.number().required()
            })
          )
        )
        .required()
    })
      .label('TestSchema')
      .description('a test schema definition');

    const result = convertSchema({ sortPropertiesByName: false }, schema);
    expect(result).not.toBeUndefined;

    expect(result?.content).toBe(`/**
 * a test schema definition
 */
export interface TestSchema {
  test: {
    [x: string]: Foo | Baz | string | {
      bar: number;
    };
  };
}`);
  });
});
