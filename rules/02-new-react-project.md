# New react project

Rules when creating new react project

## Steps

### 1. Create the project using vite

- Get appName from user request
- Use vite to generate project `echo -e "n\ny\n" | npm create vite@latest {appName} -- --template react-ts`
- cd {appName}

### 2. Setup git

- Initialize git repo
- create git remote on github under account ln613@hotmail.com

### 3. Setup netlify function

<!-- - create netlify project pointing to the github repo just created under the same account -->
- create a serverless function 'api' under netlify/functions, which handles all APIs
- netlify/functions should serve as the main server folder, it should have its own package.json, and server side packages should be installed under netlify/functions. All server side code should be in ES Module format and should be under netlify/functions/utils except api.js
- define an object 'apiHandlers' for the mapping between api method/type and its handler, for example:
```
{
  get: {
    todos: (params) => getTodos(params),
    ...
  },
  post: {
    todo: (body) => updateTodo(body),
    ...
  }
}
```

- All api handlers (getTodos, updateTodo) should be defined in a separate file, and are http ignorant, they receive data they need through function params
- In the main 'api' handler:
  1. get all url query params
  2. get request method
  3. if no 'type' param or the method/type doesn't exist in 'apiHandlers', return error
  4. get body object if method = post
  5. connect to db (see next section)
  5. get the relevant data from params/body and call the corresponding handler for the method/type
- Install netlify cli, and create an npm start script, which starts both the local netlify functions (on port 8888) and the vite dev server (on port 5173)
- in netlify.toml, specify port = 8888 (do not add targetPort)
- When the client calls the api, for local dev, use host http://localhost:8888, for qa/prod, use the same site

### 4. Setup MongoDB

- define the MongoDB connection info in .env
`MONGODB_URI=mongodb+srv://ln613:Ln-750613@nan.tjd0ruf.mongodb.net/{appName}?retryWrites=true`
- define generic db access functions in db.js, like:
  1. get(docName, filter, projection, sort, paging...)
  2. save(docName, object)
  ...
- define the connectDB function (save and reuse the db connection for future requests): for prod, connect to db {appName}, for qa, {appName}-qa, for local dev, {appName}-dev

<!-- ### 5. Create test data

- server side: create api handlers getTodos, updateTodo to read and save data to db
- server side: create some test data in the todo collection in db, which represents some todo list items. Create a API for running the seed function, and call it using curl.
- client side: create a todo list component where you can add, update and delete an todo item, and put it in the home page -->
<!-- - create test cases for the todo component use cases
- run the tests -->