# Roo task

Rules to follow when executing a roo task

## 1. Spec Coding

If the user request is exactly "spec", then perform a spec coding:

- read the markdown files under /specs, find the uncommitted spec changes
- generate source code based on the spec changes
- if the spec intro mentions that the app is multi language, handle multi language UI with resource files (include English and Simplified Chinese by default). In the specs, any string with double quote is considered a resource that needs to be translated and put into the resource file
- when you finish, do not try to test the implementation

## 2. Tests

If the user request is exactly "test", then generate and run tests:

- read the markdown files under /specs, find all "Interaction" sections
- generate test cases for each of those interactions
- run the tests

<!-- ## 1. File changes

The goal here is to make the process automatic without user interaction

- When creating a new file, touch + insert_content
- When overwriting an existing non-empty file, use write_to_file
- When making changes to an existing non-empty file, use apply_diff -->
