import { contentType } from '@optimizely/cms-sdk'
import { OptiFormsCondition } from './OptiFormsCondition'

/** Optimizely Forms — server-owned, see any OptiForms*Element for the full note. */
export const OptiFormsDependencyRule = contentType({
  key: 'OptiFormsDependencyRule',
  displayName: 'Dependency Rule',
  baseType: '_component',
  properties: {
    TargetElement:        { type: 'string' },
    TargetStep:           { type: 'string' },
    SatisfiedAction:      { type: 'string' },
    ConditionCombination: { type: 'string' },
    Conditions:           { type: 'array', items: { type: 'component', contentType: OptiFormsCondition } },
    AfterStep:            { type: 'string' },
    JumpToStep:           { type: 'string' },
  },
})
