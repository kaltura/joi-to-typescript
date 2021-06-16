import Joi from 'joi';

import { convertSchema } from '../index';

describe('test `Joi.object().pattern()`', () => {
  test('`interface pattern()`', () => {
    const schema = Joi.object({
      stringProp: Joi.string(),
      nested: Joi.object({
        nestedName: Joi.string()
      }),
      nestedPattern: Joi.object().pattern(
        Joi.string(),
        Joi.object({
          nestedRecordProperty: Joi.string()
        })
      )
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
    [x: string]: {
      nestedRecordProperty?: string;
    };
  };
}`);
  });
});
