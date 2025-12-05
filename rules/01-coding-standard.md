# Coding standard

Rules to follow when writing code

## 1. Break function into smaller functions/tasks

When writing functions, ALWAYS break the function into smaller functions/tasks with descriptive names, and defer the actual implementation to the smallest function possible. The purpose is to allow readers of the code to quickly understand what the function is doing at the high level without digging into the implementation details.

```
const saveUser = async (user) => {
  validateUser(user)
  await save('users', user) // save user to db
  await uploadImage(user.image...)
}

const validateUser = (user) => {
  if (!user) throwError('user object not provided!')

  const errors = []
  if (!user.id) errors.push('user id not provided')
  if (userExists(user.id)) errors.push('user already exists')
  ...

  if (errors.length > 0) throwErrors(errors)
}

const save = ...

const uploadImage = ...

const userExists = ...

const throwError = ...

const throwErrors = (errors) => throwError(errors.join('\n'))
```

## 2. DRY (Don't repeat yourself)

Create generic/re-usable functions whenever possible, put them into the utils folder, and when writing any new function (you already break it into smaller ones because of rule No. 1), check the utils folder to see if there are existing utils that can be used.

## 3. Input validation

Always validate input at the first line of every function. For example, validateUser in rule No. 1

## 4. No unit test

No unit test. Use case tests/integration tests only. Call real api, connect to dev db. Create test data in dev db, and NEVER create any mockup data in the source code. The only case where you should create mockup service/data is when testing payment service.

## 5. ESLint custom rules

- unused import should not be treated as error

## 6. Use prettier to format code

"trailingComma": "all",
"tabWidth": 2,
"semi": false,
"singleQuote": true,