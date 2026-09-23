---
title: How to create a promotion request
summary: Submit parts, CAD documents or documents for review and approval so they move to the next lifecycle state (for example In Work → Released).
category: Product Lifecycle Management
tags:
  - promotion request
  - promote
  - lifecycle
  - release
  - approval
  - workflow
  - maturity
updated: 2026-09-23
updatedBy: admin
---
## Overview

A **promotion request** asks approvers to move one or more objects (WTParts, CAD documents, documents) from their current lifecycle state to a new one — for example from **In Work** to **Released**. When the request is approved, Windchill changes the state of every object on the request.

> **Tip:** Menu names can differ slightly between Windchill versions and your company's configuration. If something doesn't match, look for the same action under the **Actions** menu or the object's right-click menu.

## Before you start

- The objects must be **checked in**. You can't promote an object that is checked out.
- You need permission to create promotion requests in the product or library.
- Know the **target state** you want (ask your change administrator if unsure).

## Steps

1. Open the product or library and browse to the objects you want to promote (or use search).
2. Select the objects using the check boxes.
3. From the table toolbar or **Actions** menu choose **New › New Promotion Request**.
4. On **Set Attributes**:
   - Enter a clear **Name** and **Description** explaining *why* you're promoting.
   - Choose the **Promotion Target** / **Maturity State** (for example *Released*).
5. On **Promotion Objects**, check the list:
   - Use **Collect Objects** to add related items such as the drawing or child parts.
   - Remove anything that shouldn't be promoted.
   - Fix any objects flagged with a warning (for example, checked out or already in the target state).
6. On **Set Participants** (or **Approvers / Reviewers**), add the people or roles who must review and approve.
7. Click **Finish** (or **Submit**) to start the promotion workflow.

## What happens next

- Approvers receive a task in **Home › Tasks** (and usually an email notification).
- You can follow progress from the promotion request's **Process** or **Routing History** tab.
- If an approver **rejects** the request, update the objects and create a new request or resubmit as instructed.

## Troubleshooting

| Problem | Solution |
| --- | --- |
| *New Promotion Request* is greyed out | Check the objects are checked in and you have the right permissions in this context. |
| An object can't be added | It may be checked out, in a state that can't be promoted, or already on another open request. |
| Target state isn't in the list | Your lifecycle may not allow that transition. Contact your Windchill administrator. |

## Related guides

- [How to create a WTPart](/pages/create-wtpart)
- [How to change attributes on an object](/pages/change-attributes)
