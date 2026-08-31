# Rollback Runbook

Steps for reverting an AI assistant launch safely.

## Triggers

- Critical hallucination in a customer-visible workflow.
- Permission boundary regression.
- Billing or quota enforcement failure.

## Procedure

1. Disable the launch flag.
2. Notify support and product owners.
3. Capture example prompts, retrieved documents, and assistant responses.
4. Open a regression review before re-enabling.
