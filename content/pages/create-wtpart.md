---
title: How to create a WTPart
summary: Create a new part (WTPart) in a product or library, fill in its attributes and check it in.
category: Parts & BOMs
tags:
  - WTPart
  - WT Part
  - part
  - new part
  - create part
  - BOM
updated: 2026-09-23
updatedBy: admin
---
## Overview

A **WTPart** represents a physical part or assembly in Windchill. Parts carry the attributes used by manufacturing and purchasing, can be linked to CAD documents, and are the building blocks of the product structure (BOM).

## Before you start

- Know which **product or library** the part belongs in, and which **folder**.
- Check your company's rules for **part numbering** — many sites generate numbers automatically.
- Have the required attribute values ready (name, source, unit, etc.).

## Steps

1. Browse to the product or library, then open the **Folders** page.
2. Open the folder where the part should live.
3. Click the **New Part** icon in the toolbar, or choose **Actions › New › New Part**.
4. On **Set Context** (if shown), confirm the product/library and folder.
5. On **Set Attributes**, fill in:
   - **Type** – choose the correct part subtype for your company (e.g. *Mechanical Part*).
   - **Number** – leave blank if it's generated automatically.
   - **Name** – a short, descriptive name.
   - **Source** – *Make* or *Buy*.
   - **Default Unit** – usually *each*.
   - **Assembly Mode** – *Separable*, *Inseparable* or *Component*.
   - Any other required fields (marked with an asterisk **\***).
6. *(Optional)* On **Set Classification**, or **Associate CAD**, add the extra information your site requires.
7. Click **Finish**.

> **Tip:** The new part is created **checked in** at revision **A.1** in the **In Work** state (the exact starting values depend on your configuration).

## After creating the part

- Open the part's **Structure** tab to add child parts and build the BOM.
- Use [How to change attributes](/pages/change-attributes) to update fields later.
- When it's ready for release, [create a promotion request](/pages/create-promotion-request).

## Troubleshooting

| Problem | Solution |
| --- | --- |
| *New Part* isn't available | You may not have create permission in that folder or context. |
| "Number already exists" error | Leave the number blank for auto-numbering, or pick an unused number. |
| Required attribute missing | Fields marked **\*** must be filled in before you can click Finish. |
