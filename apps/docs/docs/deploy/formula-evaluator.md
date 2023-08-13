---
id: formula-evaluator
title: Formula Evaluator
description: Jetstream let's you build and test formulas.
keywords:
  [
    salesforce,
    salesforce admin,
    salesforce developer,
    salesforce automation,
    salesforce workbench,
    salesforce metadata,
    salesforce api,
    field,
    formula,
    intellisense,
  ]
sidebar_label: Formula Evaluator
slug: /deploy/formula-evaluator
---

Jetstream has a formula evaluator so you can build and test Salesforce formulas.

the formula editor comes with some really nice features:

- Full-featured editor with syntax highlighting
- Auto-complete to help build your formulas
- Ability to run and test your formulas to see the outcome
- Ability to test formulas as different users

:::note

Some formula functions are not yet supported and some complex formulas may not work.

:::

## Evaluating a formula

1. Choose which object you would like to work on
2. Choose which user to evaluate as, your user is the default selected user
3. Choose how numbers should be treated for fields with no value
4. Choose if you want to write a formula from scratch or if you have an existing field you want to start from
   1. If you choose an existing field, the formula editor will be populated with the existing formula
5. Write your formula
6. Search and choose a record
7. Click "Test Formula"

### Editor

The advanced editor includes syntax highlighting, code completion and the ability to format your formula.

<img src={require('./formula-evaluator-editor.png').default} alt="Formula editor" />

### Intellisense

Use the shortcut `ctrl` + `space` while editing to show a list of available formulas and object and field completions.

<img src={require('./formula-evaluator-intellisense.png').default} alt="Formula intellisense" />

### Results

Your results will be evaluated based on the selected Object and record.

<img src={require('./formula-evaluator-results.png').default} alt="Formula evaluation results" />
