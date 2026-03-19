---
title: "Custom Fields"
description: "Extend company and contact records with custom fields tailored to your business data model."
---

## Overview

Every business tracks different attributes about their customers. Hissuno's custom fields let you extend the built-in company and contact schemas with additional data points specific to your organization. Custom fields appear alongside standard fields in detail views, can be populated during CSV imports, and are stored directly on each record for fast access.

## Creating Custom Fields

Custom fields are defined at the project level. Each field definition specifies which entity type it applies to (company or contact), the data type, and display properties.

### How to Create a Field

1. Navigate to **Customers** in the sidebar and select the **Custom Fields** tab.
2. Click **Add Field**.
3. Configure the field:
   - **Entity type** -- Whether this field applies to companies or contacts.
   - **Field label** -- The display name shown in the UI (for example, "NPS Score" or "Contract Type").
   - **Field key** -- A machine-readable identifier generated from the label. This is used internally and in the API. It cannot be changed after creation.
   - **Field type** -- The data type for the field (see below).
   - **Required** -- Whether the field must have a value when creating or updating a record.
   - **Position** -- Controls the display order relative to other custom fields.
4. Click **Save**.

The new field is immediately available on all existing and future records of the specified entity type.

## Field Types

Hissuno supports five custom field types, each suited to different kinds of data.

### Text

A free-form text input for strings of any length. Use this for qualitative data like notes, descriptions, or identifiers that do not fit a structured format.

**Examples:** Internal account ID, CSM name, integration notes, support tier description.

### Number

A numeric input that accepts integers and decimals. Use this for quantitative metrics and measurements.

**Examples:** NPS score, number of seats, monthly active users, support ticket count.

### Date

A date picker for temporal data. Stored in ISO format. Use this for dates and deadlines that are not covered by the built-in fields.

**Examples:** Onboarding completion date, last QBR date, contract start date, trial expiration.

### Boolean

A true/false toggle. Use this for binary attributes and flags.

**Examples:** Has signed NDA, is beta participant, opted into early access, requires SOC2 compliance.

### Select

A single-choice dropdown with predefined options. When creating a select field, you define the list of allowed values. Use this when the field should be constrained to a known set of options.

**Examples:** Region (APAC, EMEA, Americas), contract type (monthly, annual, multi-year), support level (basic, premium, enterprise).

#### Configuring Select Options

When you choose the Select field type, an additional **Options** section appears. Enter each option as a separate value. You can reorder options by dragging them, and add or remove options after the field is created. Removing an option does not clear existing values on records that already have that option selected.

## Managing Custom Fields

### Editing a Field

From the **Custom Fields** tab on the **Customers** page, click on any field to edit its properties. You can change the label, field type, required flag, select options, and position. The field key cannot be changed after creation.

Changing a field type (for example, from text to number) does not automatically convert existing values. Records that have incompatible values will display the raw stored value until updated.

### Deleting a Field

To delete a custom field, click the delete icon next to the field in the Custom Fields tab. Deleting a field definition removes it from the UI but does not erase stored values from existing records. This means if you recreate a field with the same key later, previously stored values will reappear.

### Field Ordering

Custom fields appear in the detail sidebar in the order specified by their position value. You can reorder fields by updating their position values in the Custom Fields tab, or by dragging them in the field management interface.

## Using Custom Fields

### In Detail Views

Custom fields appear in the company or contact detail sidebar below the standard fields. They follow the same inline editing pattern: hover to reveal the edit icon, click to enter edit mode, confirm to save.

For select fields, the edit mode displays a dropdown with the configured options. For boolean fields, it displays a toggle. For date fields, it displays a date picker.

### In CSV Imports

When importing companies or contacts via CSV, custom fields are available as mapping targets. During the column mapping step, your custom fields appear in the target field dropdown alongside standard fields. This lets you bulk-populate custom field values from your existing data.

### In the API

Custom fields are stored in a `custom_fields` JSON column on company and contact records. When using the API to create or update records, pass custom field values as key-value pairs in the `custom_fields` object:

```json
{
  "name": "Acme Corp",
  "domain": "acme.com",
  "custom_fields": {
    "nps_score": 72,
    "region": "EMEA",
    "contract_type": "annual"
  }
}
```

### In Filters

Custom fields are not currently available as filter dimensions in the main list views. Filtering is supported on standard fields such as stage, industry, plan tier, and country. You can use the search bar to find records by any text that appears in their fields, including custom field values.

## Limits

There is no hard limit on the number of custom fields per project, but for performance and usability we recommend keeping the total under 30 fields per entity type. Each field adds a key-value pair to the JSON column, so very large numbers of fields can increase record size.

## Best Practices

- Use descriptive field labels so your team understands what each field represents without additional documentation.
- Prefer select fields over text fields when the set of valid values is known and finite. This ensures data consistency and makes future filtering more reliable.
- Use the required flag sparingly. Marking too many fields as required can create friction when team members or automated processes create records.
- Align field keys with your external systems if you plan to use the API or CSV imports regularly. Consistent naming reduces mapping confusion.
