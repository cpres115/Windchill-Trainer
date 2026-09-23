---
title: How to change attributes on an object
summary: Edit the attributes (name, description, custom fields) of a part, document or CAD document, then check the change in.
category: Parts & BOMs
tags:
  - attributes
  - edit
  - edit attributes
  - properties
  - check out
  - check in
  - modify
updated: 2026-09-23
updatedBy: admin
---
## Overview

Most objects in Windchill — WTParts, documents and CAD documents — are **iterated**. To change their attributes you edit the object, which creates a new **iteration** (for example A.1 → A.2) when you check in.

## Before you start

- The object must be in a state that allows editing (usually **In Work**). Released objects normally need a **new revision** first.
- You need modify permission on the object.
- Make sure nobody else has it checked out.

## Steps

1. Open the object's **information page** (click its name or the *i* icon in a table).
2. Choose **Actions › Edit**. Windchill checks the object out to you automatically.
3. Update the attribute values on the **Set Attributes** step.
4. Click one of:
   - **Check In** – saves your changes and checks the object in (creates the new iteration). Add a check-in comment describing the change.
   - **Save** – keeps your changes but leaves the object **checked out** to you, so you can continue later.
5. Confirm the new values on the **Details** tab of the information page.

> **Tip:** If you clicked **Save** and forgot, the object stays checked out and nobody else can edit it. Use **Actions › Check In** to finish, or **Actions › Undo Checkout** to discard your changes.

## Changing attributes on many objects

Some sites enable an **Edit Multiple Objects** or **Edit Attributes** table action. Select several objects in a table and choose the action to update common attributes at once. If you don't see it, ask your administrator.

## Troubleshooting

| Problem | Solution |
| --- | --- |
| *Edit* is missing | The object may be released, checked out by someone else, or you lack permissions. |
| An attribute is read-only | It may be controlled by the object type, lifecycle state or an integration (e.g. from CAD). Update it at the source. |
| Can't check in | Look for required attributes left blank, or conflicts listed in the check-in window. |

## Related guides

- [How to create a WTPart](/pages/create-wtpart)
- [How to create a promotion request](/pages/create-promotion-request)
